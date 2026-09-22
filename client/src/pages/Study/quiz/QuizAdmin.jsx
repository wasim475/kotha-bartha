import { Add, Block, CheckCircle } from "@mui/icons-material";
import { useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { api } from "../../../utility/api";
import { ResourceState, useResource } from "../../../utility/helpers";
import { cx } from "../../../utility/cx";
import AddNameDialog from "./AddNameDialog";

const OPTION_LABELS = ["A", "B", "C", "D"];
const EMPTY_OPTIONS = ["", "", "", ""];

/**
 * Admin/moderator quiz management, reached from inside the Quiz section
 * (not the topbar): Category -> [Class -> বিভাগ if SSC] -> Subject
 * (+ Add Subject) -> Chapter (+ Add Chapter) -> question authoring form,
 * with a live "X / 30 — N more needed for Set N" progress readout. Every
 * create call hits routes gated server-side by
 * requireRole("admin","moderator") (see server/src/routes/quiz.routes.js)
 * — the `user.role` check below is only a UI convenience, not the real
 * enforcement.
 */
export default function QuizAdmin({ user }) {
  const [category, setCategory] = useState(null);
  const [classLevel, setClassLevel] = useState(null);
  const [division, setDivision] = useState(null);
  const [subject, setSubject] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [addChapterOpen, setAddChapterOpen] = useState(false);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [correctIndex, setCorrectIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [justPublishedSet, setJustPublishedSet] = useState(null);

  const categories = useResource("/quiz/categories");
  const classLevels = useResource(category === "class" ? "/quiz/class-levels" : null);
  const divisions = useResource(category === "class" && classLevel === "SSC" ? "/quiz/ssc-divisions" : null);

  // Subjects only become fetchable once every prior required step is
  // resolved: for "class" that's classLevel (+division when SSC); for the
  // other two categories, the category alone is enough.
  const subjectsReady =
    category && (category !== "class" || (classLevel && (classLevel !== "SSC" || division)));
  const subjectsQuery = subjectsReady
    ? category === "class"
      ? `category=class&classLevel=${classLevel}${classLevel === "SSC" ? `&division=${encodeURIComponent(division)}` : ""}`
      : `category=${category}`
    : null;
  const subjects = useResource(subjectsQuery ? `/quiz/subjects?${subjectsQuery}` : null);
  const chapters = useResource(subject ? `/quiz/chapters?subjectId=${subject.id}` : null);
  const summary = useResource(chapter ? `/quiz/chapters/${chapter.id}/admin-summary` : null);

  const allowed = user?.role === "admin" || user?.role === "moderator";

  if (!allowed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Block fontSize="small" />
        </div>
        <p className="text-sm text-muted">
          Quiz management is only available to admins and moderators.
        </p>
      </div>
    );
  }

  const createSubject = async (name) => {
    const { data } = await api.post("/quiz/subjects", { name, category, classLevel, division });
    subjects.setData((current = []) => [...current, data.data].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const createChapter = async (name) => {
    const { data } = await api.post("/quiz/chapters", { name, subjectId: subject.id });
    chapters.setData((current = []) => [...current, data.data]);
  };

  const resetForm = () => {
    setQuestion("");
    setOptions(EMPTY_OPTIONS);
    setCorrectIndex(null);
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    if (saving) return;
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((option) => option.trim());

    if (!trimmedQuestion || trimmedOptions.some((option) => !option) || correctIndex === null) {
      setFormError("Fill in the question, all 4 options, and pick the correct answer.");
      return;
    }

    setSaving(true);
    setFormError("");
    setJustPublishedSet(null);
    try {
      const { data } = await api.post(`/quiz/chapters/${chapter.id}/questions`, {
        question: trimmedQuestion,
        options: trimmedOptions,
        correctIndex,
      });
      summary.setData(data.data.summary);
      if (data.data.setJustPublished) setJustPublishedSet(data.data.setNumber);
      resetForm();
    } catch (submitError) {
      setFormError(submitError.response?.data?.error?.message || "Couldn't save that question.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Quiz Management</h1>
        <p className="text-sm text-muted">Create subjects, chapters and questions.</p>
      </div>

      {/* Category */}
      <Card className="flex flex-col gap-2">
        <label className="text-xs font-semibold tracking-wide text-muted uppercase">Quiz Category</label>
        <ResourceState loading={categories.loading} error={categories.error}>
          <select
            value={category || ""}
            onChange={(event) => {
              setCategory(event.target.value || null);
              setClassLevel(null);
              setDivision(null);
              setSubject(null);
              setChapter(null);
            }}
            className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Select a category…</option>
            {(categories.data || []).map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </ResourceState>
      </Card>

      {/* Class */}
      {category === "class" && (
        <Card className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted uppercase">Class</label>
          <ResourceState loading={classLevels.loading} error={classLevels.error}>
            <select
              value={classLevel || ""}
              onChange={(event) => {
                setClassLevel(event.target.value || null);
                setDivision(null);
                setSubject(null);
                setChapter(null);
              }}
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">Select a class…</option>
              {(classLevels.data || []).map((level) => (
                <option key={level} value={level}>
                  {level === "SSC" ? "SSC" : `Class ${level}`}
                </option>
              ))}
            </select>
          </ResourceState>
        </Card>
      )}

      {/* Division — SSC only */}
      {category === "class" && classLevel === "SSC" && (
        <Card className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted uppercase">বিভাগ</label>
          <ResourceState loading={divisions.loading} error={divisions.error}>
            <select
              value={division || ""}
              onChange={(event) => {
                setDivision(event.target.value || null);
                setSubject(null);
                setChapter(null);
              }}
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">বিভাগ নির্বাচন করুন…</option>
              {(divisions.data || []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </ResourceState>
        </Card>
      )}

      {/* Subject */}
      {subjectsReady && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-wide text-muted uppercase">Subject</label>
            <button
              type="button"
              onClick={() => setAddSubjectOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <Add style={{ fontSize: 14 }} /> Add Subject
            </button>
          </div>
          <ResourceState loading={subjects.loading} error={subjects.error}>
            {subjects.data?.length ? (
              <select
                value={subject?.id || ""}
                onChange={(event) => {
                  const found = subjects.data.find((item) => item.id === event.target.value);
                  setSubject(found || null);
                  setChapter(null);
                }}
                className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">Select a subject…</option>
                {subjects.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted">No subjects yet — add one above.</p>
            )}
          </ResourceState>
        </Card>
      )}

      {/* Chapter */}
      {subject && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-wide text-muted uppercase">Chapter</label>
            <button
              type="button"
              onClick={() => setAddChapterOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <Add style={{ fontSize: 14 }} /> Add Chapter
            </button>
          </div>
          <ResourceState loading={chapters.loading} error={chapters.error}>
            {chapters.data?.length ? (
              <select
                value={chapter?.id || ""}
                onChange={(event) => {
                  const found = chapters.data.find((item) => item.id === event.target.value);
                  setChapter(found || null);
                  setJustPublishedSet(null);
                }}
                className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">Select a chapter…</option>
                {chapters.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted">No chapters yet — add one above.</p>
            )}
          </ResourceState>
        </Card>
      )}

      {/* Question progress + form */}
      {chapter && (
        <ResourceState loading={summary.loading} error={summary.error}>
          {summary.data && (
            <>
              <Card className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-ink">
                  Current Questions: {summary.data.questionsInCurrentSet} / 30
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-all motion-safe:duration-300"
                    style={{ width: `${(summary.data.questionsInCurrentSet / 30) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {summary.data.remainingForCurrentSet} more question
                  {summary.data.remainingForCurrentSet === 1 ? "" : "s"} needed to complete Set{" "}
                  {summary.data.currentSetNumber}.
                  {summary.data.publishedSets > 0 &&
                    ` ${summary.data.publishedSets} set${summary.data.publishedSets === 1 ? "" : "s"} already published.`}
                </p>
                {justPublishedSet && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                    <CheckCircle style={{ fontSize: 15 }} /> Quiz Set {justPublishedSet} is now available!
                  </p>
                )}
              </Card>

              <Card as="form" onSubmit={submitQuestion} className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Question
                  </label>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Type the question…"
                    className="mt-1.5 w-full resize-none rounded-md border border-line bg-paper p-2.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>

                <div className="grid gap-2.5">
                  {options.map((optionValue, index) => (
                    <div key={index} className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(index)}
                        aria-label={`Mark option ${OPTION_LABELS[index]} as correct`}
                        className={cx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                          correctIndex === index
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-line text-muted hover:border-accent hover:text-accent",
                        )}
                      >
                        {OPTION_LABELS[index]}
                      </button>
                      <input
                        value={optionValue}
                        onChange={(event) =>
                          setOptions((current) =>
                            current.map((value, i) => (i === index ? event.target.value : value)),
                          )
                        }
                        placeholder={`Option ${OPTION_LABELS[index]}`}
                        maxLength={300}
                        className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  Tap the letter beside an option to mark it as the correct answer.
                </p>

                {formError && <p className="text-xs font-medium text-danger">{formError}</p>}

                <Button variant="primary" type="submit" loading={saving} disabled={saving}>
                  Submit Question
                </Button>
              </Card>
            </>
          )}
        </ResourceState>
      )}

      <AddNameDialog
        open={addSubjectOpen}
        title="Add Subject"
        placeholder="e.g. Science"
        onClose={() => setAddSubjectOpen(false)}
        onCreate={createSubject}
      />
      <AddNameDialog
        open={addChapterOpen}
        title="Add Chapter"
        placeholder="e.g. Chapter 3 — Matter"
        onClose={() => setAddChapterOpen(false)}
        onCreate={createChapter}
      />
    </div>
  );
}
