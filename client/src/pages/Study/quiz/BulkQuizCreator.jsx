import { CheckCircle, ContentPaste, ErrorOutlined } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { api } from "../../../utility/api";
import BulkQuestionCard from "./BulkQuestionCard";
import { parseBulkQuestions } from "./parseBulkQuestions";

const PLACEHOLDER = `প্রশ্ন ১:
বর্তনীতে বৈদ্যুতিক অবস্থা পরিমাপের জন্য ব্যবহার করা হয়—

ক) ভোল্টমিটার ও অ্যামিটার ✅
খ) অ্যামিটার ও জেনারেটর
গ) ভোল্টমিটার ও জেনারেটর
ঘ) ভোল্টমিটার, অ্যামিটার ও জেনারেটর

প্রশ্ন ২:
বিদ্যুৎ প্রবাহ মাপার যন্ত্র কোনটি?

ক) ভোল্টমিটার
খ) অ্যামিটার ✅
গ) জেনারেটর
ঘ) ট্রান্সফরমার`;

/**
 * Bulk question creation for the Add Quiz page. Paste many questions at
 * once → parse (reusing the exact same per-question detection as the
 * single-question form's smart paste, see parseBulkQuestions.js) → review
 * and fix any question inline in a compact editable list → confirm → one
 * multipart request creates every question (server/src/routes/quiz.routes.js's
 * POST .../questions/bulk), computing Set numbers exactly like the
 * single-question endpoint does, just for the whole batch in one pass.
 */
export default function BulkQuizCreator({ chapter, contextSummary, summary }) {
  const [rawText, setRawText] = useState("");
  const [parseErrors, setParseErrors] = useState([]);
  const [parsedTotal, setParsedTotal] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgressLabel, setSubmitProgressLabel] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Revoke every remaining preview URL when the whole batch is discarded
  // (parsing again or unmounting) — mirrors the single-question form's own
  // object-URL cleanup.
  const revokeAllPreviews = (list) => {
    list.forEach((item) => item.images.forEach((image) => URL.revokeObjectURL(image.previewUrl)));
  };

  useEffect(() => {
    return () => revokeAllPreviews(questionsRef.current);
  }, []);

  const parse = () => {
    revokeAllPreviews(questions);
    setResult(null);
    setSubmitError("");
    const parsed = parseBulkQuestions(rawText);
    setParsedTotal(parsed.total);
    setParseErrors(parsed.errors);
    setQuestions(parsed.questions.map((q) => ({ ...q, images: [], imageCaption: "" })));
  };

  const updateQuestion = (index, updated) => {
    setQuestions((current) => current.map((item, i) => (i === index ? updated : item)));
  };

  const deleteQuestion = (index) => {
    setQuestions((current) => current.filter((_, i) => i !== index));
  };

  const hasImages = questions.some((item) => item.images.length > 0);

  const submitBatch = async () => {
    if (submitting || questions.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    setConfirmOpen(false);
    setSubmitProgressLabel(`Creating ${questions.length} question${questions.length === 1 ? "" : "s"}…`);
    try {
      let data;
      const payload = questions.map((item) => ({
        question: item.question.trim(),
        options: item.options.map((option) => option.trim()),
        correctIndex: item.correctIndex,
        imageCaption: item.imageCaption.trim(),
      }));

      if (hasImages) {
        const formData = new FormData();
        formData.append("questions", JSON.stringify(payload));
        questions.forEach((item, index) => {
          item.images.forEach((image) => formData.append(`question-${index}-images`, image.file));
        });
        ({ data } = await api.post(`/quiz/chapters/${chapter.id}/questions/bulk`, formData));
      } else {
        ({ data } = await api.post(`/quiz/chapters/${chapter.id}/questions/bulk`, { questions: payload }));
      }

      summary.setData(data.data.summary);
      setResult(data.data);
      revokeAllPreviews(questions);
      setRawText("");
      setQuestions([]);
      setParsedTotal(null);
      setParseErrors([]);
    } catch (error) {
      setSubmitError(error.response?.data?.error?.message || "Couldn't create these questions.");
    } finally {
      setSubmitting(false);
      setSubmitProgressLabel("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <label className="text-xs font-semibold tracking-wide text-muted uppercase">Paste multiple questions</label>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={10}
          placeholder={PLACEHOLDER}
          className="w-full resize-y rounded-md border border-line bg-paper p-3 font-sans text-sm leading-relaxed text-ink outline-none placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="text-[11px] text-muted">
          Each question: text, then ক)/A) … ঘ)/D) options, with ✅, ✔, ✓, or [correct] marking the right answer.
        </p>
        <Button variant="primary" size="sm" className="self-start" onClick={parse} disabled={!rawText.trim()}>
          <ContentPaste fontSize="small" /> Parse Questions
        </Button>
      </Card>

      {parsedTotal !== null && (
        <Card className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CheckCircle fontSize="small" className="text-green-600 dark:text-green-400" />
            {questions.length} of {parsedTotal} question{parsedTotal === 1 ? "" : "s"} parsed successfully
          </p>
          {parseErrors.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-lg bg-danger-soft p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <ErrorOutlined style={{ fontSize: 15 }} /> Parsing completed with {parseErrors.length} error
                {parseErrors.length === 1 ? "" : "s"}
              </p>
              {parseErrors.map((err) => (
                <p key={err.index} className="text-[11px] text-danger">
                  ⚠ Question {err.index}: {err.message}
                </p>
              ))}
              <p className="text-[11px] text-muted">
                Fix these in your pasted text and parse again — the {questions.length} question
                {questions.length === 1 ? "" : "s"} already parsed below are unaffected.
              </p>
            </div>
          )}
        </Card>
      )}

      {questions.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {questions.map((item, index) => (
              <BulkQuestionCard
                key={index}
                item={item}
                index={index}
                onChange={(updated) => updateQuestion(index, updated)}
                onDelete={() => deleteQuestion(index)}
              />
            ))}
          </div>

          {submitError && <p className="text-xs font-medium text-danger">{submitError}</p>}

          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting}
            onClick={() => setConfirmOpen(true)}
          >
            {submitting ? submitProgressLabel || "Creating questions…" : "Create All Questions"}
          </Button>
        </>
      )}

      {result && (
        <Card className="flex flex-col gap-1 border-green-500/40 bg-green-500/5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300">
            <CheckCircle fontSize="small" /> {result.createdCount} question{result.createdCount === 1 ? "" : "s"} created successfully
          </p>
          {result.newlyPublishedSets.map((setNumber) => (
            <p key={setNumber} className="text-xs text-green-700 dark:text-green-300">
              ✓ Quiz Set {setNumber} created
            </p>
          ))}
          {result.summary.questionsInCurrentSet > 0 && (
            <p className="text-xs text-muted">
              {result.summary.remainingForCurrentSet} more question{result.summary.remainingForCurrentSet === 1 ? "" : "s"} needed to
              create Set {result.summary.currentSetNumber}.
            </p>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Create All Questions?"
        description={`You are about to create ${questions.length} question${questions.length === 1 ? "" : "s"} · ${contextSummary}`}
        confirmLabel="Create All Questions"
        cancelLabel="Cancel"
        loading={submitting}
        onConfirm={submitBatch}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
