const express = require("express");
const { requireRole } = require("../middleware/requireRole");
const {
  listQuestions,
  createQuestion,
  updateQuestion,
  setQuestionActive,
} = require("../services/englishQuestion.service");
const { respond } = require("../utils/gameRespond");

const router = express.Router();

// English Game question management — admins and moderators only, enforced
// HERE on the server for every method and path under the prefix (the same
// requireRole the Quiz management routes use, mounted after requireAuth).
// Hiding the buttons in React is only a convenience; a normal user calling
// these endpoints directly gets 403. These responses include the correct
// answer, which is exactly why nothing else may reach them.
router.use("/games/english-questions", requireRole("admin", "moderator"));

// List + live counts. Query: questionType, gameType, status (active|inactive), search, page.
router.get(
  "/games/english-questions",
  respond(async (req) => {
    const { items, meta } = await listQuestions({
      questionType: req.query.questionType,
      gameType: req.query.gameType,
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
    });
    return { data: items, meta };
  }),
);

// Body: { questionType, question, options: [4 strings], correctIndex }
router.post(
  "/games/english-questions",
  respond(async (req) => ({ data: await createQuestion(req.user, req.body || {}) }), 201),
);

// Edit any subset of { questionType, question, options, correctIndex }.
router.patch(
  "/games/english-questions/:questionId",
  respond(async (req) => ({ data: await updateQuestion(req.user, req.params.questionId, req.body || {}) })),
);

// Enable / disable — { active: true | false }. Disabling is preferred over
// deleting: the question leaves play but stays on record.
router.patch(
  "/games/english-questions/:questionId/active",
  respond(async (req) => ({
    data: await setQuestionActive(req.user, req.params.questionId, req.body?.active),
  })),
);

module.exports = router;
