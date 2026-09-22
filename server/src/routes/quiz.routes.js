const express = require("express");
const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const QuizQuestion = require("../models/QuizQuestion");
const QuizAttempt = require("../models/QuizAttempt");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

const { CLASS_LEVELS, SSC_DIVISIONS, QUIZ_CATEGORIES } = Subject;
const { QUESTIONS_PER_SET } = QuizQuestion;

const QUIZ_CATEGORY_LABELS = {
  class: "Class-based Quiz",
  general_knowledge: "সাধারণ জ্ঞান",
  sports: "Sports",
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fisher-Yates — used for both question order and, separately, each
// question's own option order. Never persisted back onto QuizQuestion
// itself; only ever stored per-attempt (see QuizAttempt.js), so the
// underlying question bank order never changes.
function shuffledIndices(length) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

async function chapterQuestionSummary(chapterId) {
  const total = await QuizQuestion.countDocuments({ chapterId });
  const publishedSets = Math.floor(total / QUESTIONS_PER_SET);
  const questionsInCurrentSet = total % QUESTIONS_PER_SET;
  return {
    totalQuestions: total,
    publishedSets,
    currentSetNumber: publishedSets + 1,
    questionsInCurrentSet,
    remainingForCurrentSet: QUESTIONS_PER_SET - questionsInCurrentSet,
  };
}

// Builds everything the client needs to render/resume an attempt — every
// question's (already-shuffled) options, but the correct answer only for
// questions this attempt has already answered. This is the one place that
// decides what's safe to send the client, so no other route needs to
// re-derive it.
async function serializeAttemptForClient(attempt) {
  const questions = await QuizQuestion.find({ _id: { $in: attempt.questionOrder } })
    .select("question options correctIndex")
    .lean();
  const questionsById = new Map(questions.map((question) => [question._id.toString(), question]));
  const answersByQuestionId = new Map(
    attempt.answers.map((answer) => [answer.questionId.toString(), answer]),
  );

  const questionItems = attempt.questionOrder.map((questionId, index) => {
    const question = questionsById.get(questionId.toString());
    const optionOrder = attempt.optionOrders[index];
    const options = optionOrder.map((originalIndex) => question.options[originalIndex]);
    const answer = answersByQuestionId.get(questionId.toString());

    const item = {
      index,
      questionId: questionId.toString(),
      question: question.question,
      options,
      answered: Boolean(answer),
    };

    if (answer) {
      item.selectedPosition = answer.selectedPosition;
      item.correct = answer.correct;
      item.correctPosition = optionOrder.indexOf(question.correctIndex);
    }

    return item;
  });

  return {
    attemptId: attempt._id.toString(),
    chapterId: attempt.chapterId.toString(),
    setNumber: attempt.setNumber,
    status: attempt.status,
    isFirstAttempt: attempt.isFirstAttempt,
    currentIndex: attempt.currentIndex,
    totalQuestions: attempt.questionOrder.length,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    score: attempt.score,
    questions: questionItems,
  };
}

// ============================================================
// QUIZ CATEGORIES / CLASS LEVELS / SSC DIVISIONS (static lists)
// ============================================================

router.get("/quiz/categories", (req, res) => {
  res.json({
    data: QUIZ_CATEGORIES.map((key) => ({ key, label: QUIZ_CATEGORY_LABELS[key] })),
  });
});

router.get("/quiz/class-levels", (req, res) => {
  res.json({ data: CLASS_LEVELS });
});

router.get("/quiz/ssc-divisions", (req, res) => {
  res.json({ data: SSC_DIVISIONS });
});

// Shared by GET/POST /quiz/subjects — validates category (+classLevel
// +division, only when applicable) and returns the exact filter to query
// or persist with. Throws a { status, code, message } on invalid input.
function resolveSubjectScope(query) {
  const category = String(query.category || "");
  if (!QUIZ_CATEGORIES.includes(category)) {
    throw { status: 400, code: "INVALID_CATEGORY", message: "Choose a valid quiz category." };
  }

  if (category !== "class") {
    return { category };
  }

  const classLevel = String(query.classLevel || "");
  if (!CLASS_LEVELS.includes(classLevel)) {
    throw { status: 400, code: "INVALID_CLASS", message: "Choose a valid class." };
  }

  if (classLevel !== "SSC") {
    return { category, classLevel, division: null };
  }

  const division = String(query.division || "");
  if (!SSC_DIVISIONS.includes(division)) {
    throw { status: 400, code: "INVALID_DIVISION", message: "Choose a valid division." };
  }
  return { category, classLevel, division };
}

// ============================================================
// SUBJECTS
// ============================================================

router.get("/quiz/subjects", async (req, res, next) => {
  try {
    const scope = resolveSubjectScope(req.query);
    const subjects = await Subject.find(scope).sort({ name: 1 }).lean();
    res.json({
      data: subjects.map((subject) => ({
        id: subject._id.toString(),
        name: subject.name,
        category: subject.category,
        classLevel: subject.classLevel || null,
        division: subject.division || null,
      })),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    next(error);
  }
});

router.post("/quiz/subjects", requireRole("admin", "moderator"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Subject name is required." },
      });
    }

    const scope = resolveSubjectScope(req.body);

    const duplicate = await Subject.findOne({
      ...scope,
      name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
    });
    if (duplicate) {
      return res.status(409).json({
        error: { code: "DUPLICATE", message: "That subject already exists here." },
      });
    }

    // Omit null-valued scope fields (e.g. division on a non-SSC class
    // subject) rather than storing them explicitly — keeps the enum
    // validator happy and leaves the field genuinely unset.
    const createFields = Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== null));
    const subject = await Subject.create({ name, ...createFields, createdBy: req.user._id });
    res.status(201).json({
      data: {
        id: subject._id.toString(),
        name: subject.name,
        category: subject.category,
        classLevel: subject.classLevel || null,
        division: subject.division || null,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error.code === 11000) {
      return res.status(409).json({
        error: { code: "DUPLICATE", message: "That subject already exists here." },
      });
    }
    next(error);
  }
});

// ============================================================
// CHAPTERS
// ============================================================

router.get("/quiz/chapters", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.subjectId)) {
      return res.status(400).json({
        error: { code: "INVALID_SUBJECT", message: "Choose a valid subject." },
      });
    }

    const chapters = await Chapter.find({ subjectId: req.query.subjectId })
      .sort({ createdAt: 1 })
      .lean();
    res.json({
      data: chapters.map((chapter) => ({
        id: chapter._id.toString(),
        name: chapter.name,
        subjectId: chapter.subjectId.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quiz/chapters", requireRole("admin", "moderator"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!mongoose.isValidObjectId(req.body.subjectId)) {
      return res.status(400).json({
        error: { code: "INVALID_SUBJECT", message: "Choose a valid subject." },
      });
    }
    if (!name) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Chapter name is required." },
      });
    }

    const subject = await Subject.findById(req.body.subjectId);
    if (!subject) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Subject not found." } });
    }

    const duplicate = await Chapter.findOne({
      subjectId: subject._id,
      name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
    });
    if (duplicate) {
      return res.status(409).json({
        error: { code: "DUPLICATE", message: "That chapter already exists for this subject." },
      });
    }

    const chapter = await Chapter.create({
      name,
      subjectId: subject._id,
      category: subject.category,
      classLevel: subject.classLevel || undefined,
      division: subject.division || undefined,
      createdBy: req.user._id,
    });

    res.status(201).json({
      data: { id: chapter._id.toString(), name: chapter.name, subjectId: subject._id.toString() },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: { code: "DUPLICATE", message: "That chapter already exists for this subject." },
      });
    }
    next(error);
  }
});

// ============================================================
// ADMIN: QUESTION AUTHORING
// ============================================================

router.get(
  "/quiz/chapters/:chapterId/admin-summary",
  requireRole("admin", "moderator"),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.chapterId)) {
        return res.status(400).json({
          error: { code: "INVALID_CHAPTER", message: "Choose a valid chapter." },
        });
      }
      res.json({ data: await chapterQuestionSummary(req.params.chapterId) });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/quiz/chapters/:chapterId/questions",
  requireRole("admin", "moderator"),
  async (req, res, next) => {
    try {
      const chapter = await Chapter.findById(req.params.chapterId);
      if (!chapter) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Chapter not found." } });
      }

      const question = String(req.body.question || "").trim();
      const options = Array.isArray(req.body.options)
        ? req.body.options.map((option) => String(option || "").trim())
        : [];
      const correctIndex = Number(req.body.correctIndex);

      if (!question) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Question text is required." },
        });
      }
      if (options.length !== 4 || options.some((option) => !option)) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Exactly 4 non-empty options are required." },
        });
      }
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Choose the correct option." },
        });
      }

      const slotIndex = await QuizQuestion.countDocuments({ chapterId: chapter._id });
      const setNumber = Math.floor(slotIndex / QUESTIONS_PER_SET) + 1;

      let created;
      try {
        created = await QuizQuestion.create({
          chapterId: chapter._id,
          subjectId: chapter.subjectId,
          classLevel: chapter.classLevel,
          question,
          options,
          correctIndex,
          slotIndex,
          setNumber,
          createdBy: req.user._id,
        });
      } catch (createError) {
        if (createError.code === 11000) {
          return res.status(409).json({
            error: {
              code: "CONFLICT",
              message: "Someone else just added a question — please try again.",
            },
          });
        }
        throw createError;
      }

      const summary = await chapterQuestionSummary(chapter._id);
      const setJustPublished = summary.questionsInCurrentSet === 0 && summary.publishedSets === setNumber;

      res.status(201).json({
        data: { id: created._id.toString(), setNumber, summary, setJustPublished },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// USER: QUIZ SETS FOR A CHAPTER
// ============================================================

router.get("/quiz/chapters/:chapterId/sets", async (req, res, next) => {
  try {
    const chapterId = req.params.chapterId;
    if (!mongoose.isValidObjectId(chapterId)) {
      return res.status(400).json({
        error: { code: "INVALID_CHAPTER", message: "Choose a valid chapter." },
      });
    }

    const { publishedSets } = await chapterQuestionSummary(chapterId);
    if (!publishedSets) return res.json({ data: [] });

    const setNumbers = Array.from({ length: publishedSets }, (_, index) => index + 1);
    const attempts = await QuizAttempt.find({
      userId: req.user._id,
      chapterId,
      setNumber: { $in: setNumbers },
    }).lean();

    const data = setNumbers.map((setNumber) => {
      const forSet = attempts.filter((attempt) => attempt.setNumber === setNumber);
      const inProgress = forSet.find((attempt) => attempt.status === "in_progress");
      const completedFirst = forSet.find(
        (attempt) => attempt.status === "completed" && attempt.isFirstAttempt,
      );
      const completedAttempts = forSet
        .filter((attempt) => attempt.status === "completed")
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

      return {
        setNumber,
        totalQuestions: QUESTIONS_PER_SET,
        status: inProgress ? "in_progress" : completedFirst ? "completed" : "not_started",
        currentIndex: inProgress ? inProgress.currentIndex : 0,
        firstAttemptScore: completedFirst ? completedFirst.score : null,
        lastScore: completedAttempts[0] ? completedAttempts[0].score : null,
        completedAttempts: completedAttempts.length,
      };
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER: START OR RESUME AN ATTEMPT
// ============================================================

router.post("/quiz/chapters/:chapterId/sets/:setNumber/start", async (req, res, next) => {
  try {
    const chapterId = req.params.chapterId;
    const setNumber = Number(req.params.setNumber);

    if (!mongoose.isValidObjectId(chapterId) || !Number.isInteger(setNumber) || setNumber < 1) {
      return res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "Invalid quiz set." },
      });
    }

    const availableQuestions = await QuizQuestion.countDocuments({ chapterId, setNumber });
    if (availableQuestions < QUESTIONS_PER_SET) {
      return res.status(404).json({
        error: { code: "SET_UNAVAILABLE", message: "This quiz set isn't available yet." },
      });
    }

    let attempt = await QuizAttempt.findOne({
      userId: req.user._id,
      chapterId,
      setNumber,
      status: "in_progress",
    });

    if (!attempt) {
      const hasFirstAttempt = await QuizAttempt.exists({
        userId: req.user._id,
        chapterId,
        setNumber,
        isFirstAttempt: true,
      });

      const questions = await QuizQuestion.find({ chapterId, setNumber }).select("_id").lean();
      const order = shuffledIndices(questions.length).map((index) => questions[index]._id);
      const optionOrders = order.map(() => shuffledIndices(4));

      try {
        attempt = await QuizAttempt.create({
          userId: req.user._id,
          chapterId,
          setNumber,
          isFirstAttempt: !hasFirstAttempt,
          questionOrder: order,
          optionOrders,
        });
      } catch (createError) {
        if (createError.code === 11000) {
          // Lost a race against another in-flight "start" request for the
          // same user+chapter+set — whichever one actually landed is the
          // attempt to resume.
          attempt = await QuizAttempt.findOne({
            userId: req.user._id,
            chapterId,
            setNumber,
            status: "in_progress",
          });
          if (!attempt) throw createError;
        } else {
          throw createError;
        }
      }
    }

    res.json({ data: await serializeAttemptForClient(attempt) });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// USER: ANSWER THE CURRENT QUESTION
// ============================================================

router.post("/quiz/attempts/:attemptId/answer", async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
    });
    if (!attempt) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attempt not found." } });
    }
    if (attempt.status === "completed") {
      return res.status(400).json({
        error: { code: "ALREADY_COMPLETED", message: "This attempt is already finished." },
      });
    }

    const questionIndex = Number(req.body.questionIndex);
    const selectedPosition = Number(req.body.selectedPosition);

    // Only the attempt's CURRENT question can be answered — blocks
    // replaying an already-answered question or skipping ahead by
    // sending an arbitrary index from the client.
    if (questionIndex !== attempt.currentIndex) {
      return res.status(409).json({
        error: { code: "OUT_OF_SEQUENCE", message: "That question isn't currently active." },
      });
    }
    if (!Number.isInteger(selectedPosition) || selectedPosition < 0 || selectedPosition > 3) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Choose an option." },
      });
    }

    const questionId = attempt.questionOrder[questionIndex];
    const question = await QuizQuestion.findById(questionId).select("correctIndex");
    const optionOrder = attempt.optionOrders[questionIndex];
    const originalIndex = optionOrder[selectedPosition];
    const correct = originalIndex === question.correctIndex;
    const correctPosition = optionOrder.indexOf(question.correctIndex);

    attempt.answers.push({ questionId, selectedPosition, correct, answeredAt: new Date() });
    attempt.currentIndex += 1;
    if (correct) {
      attempt.correctCount += 1;
      attempt.score += 1;
    } else {
      attempt.wrongCount += 1;
      attempt.score -= 1;
    }

    const isComplete = attempt.currentIndex >= attempt.questionOrder.length;
    if (isComplete) {
      attempt.status = "completed";
      attempt.completedAt = new Date();
    }

    await attempt.save();

    res.json({
      data: {
        correct,
        correctPosition,
        scoreDelta: correct ? 1 : -1,
        score: attempt.score,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        currentIndex: attempt.currentIndex,
        totalQuestions: attempt.questionOrder.length,
        isComplete,
        isFirstAttempt: attempt.isFirstAttempt,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
