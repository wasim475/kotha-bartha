import { useState } from "react";

import Card from "../../../../components/ui/Card";
import { api } from "../../../../utility/api";
import { cx } from "../../../../utility/cx";
import FixedButton from "../components/FixedButton";

const OPTION_LABELS = ["A", "B", "C", "D"];
const GAME_NAMES = { "english-word": "English Word Game", "english-conversion": "English Conversion Game" };

const inputClass =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

// Mirrors the server's rules (englishQuestion.service.js) so mistakes show up
// instantly — the server still re-checks everything and is the real gate.
function validate({ questionType, question, options, correctIndex }) {
  if (!questionType) return "Choose a question type.";
  if (!question.trim()) return "The question can't be empty.";
  for (let i = 0; i < options.length; i++) {
    if (!options[i].trim()) return `Option ${OPTION_LABELS[i]} can't be empty.`;
  }
  const seen = new Map();
  for (let i = 0; i < options.length; i++) {
    const key = options[i].trim().toLowerCase();
    if (seen.has(key)) {
      return `Options must all be different — Option ${OPTION_LABELS[seen.get(key)]} and Option ${OPTION_LABELS[i]} are the same.`;
    }
    seen.set(key, i);
  }
  if (correctIndex === null) return "Select the correct answer.";
  return "";
}

/**
 * Add / edit one English Game question. Mirrors QuizAdmin's question form
 * (labels, radio rows, error line) so it reads as the same admin tool.
 * `question` is the existing question when editing, or null when adding.
 */
export default function EnglishQuestionForm({ question, types, onSaved, onCancel }) {
  const editing = Boolean(question);
  const [questionType, setQuestionType] = useState(question?.questionType || "");
  const [text, setText] = useState(question?.question || "");
  const [options, setOptions] = useState(question?.options || ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(question ? question.correctIndex : null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const gameType = types.find((type) => type.key === questionType)?.gameType;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const message = validate({ questionType, question: text, options, correctIndex });
    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    setError("");
    const body = {
      questionType,
      question: text.trim(),
      options: options.map((option) => option.trim()),
      correctIndex,
    };
    try {
      const { data } = editing
        ? await api.patch(`/games/english-questions/${question.id}`, body)
        : await api.post("/games/english-questions", body);
      onSaved(data.data, editing);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || "Couldn't save this question.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card as="form" onSubmit={submit} noValidate className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-ink">{editing ? "Edit question" : "Add a question"}</h2>
      </div>

      <div>
        <label htmlFor="eq-type" className="text-xs font-semibold tracking-wide text-muted uppercase">
          Question type
        </label>
        <select
          id="eq-type"
          value={questionType}
          onChange={(event) => setQuestionType(event.target.value)}
          className={cx(inputClass, "mt-1.5 py-2.5")}
        >
          <option value="">Select a type…</option>
          {types.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </select>
        {gameType && <p className="mt-1.5 text-[11px] text-muted">Appears in the {GAME_NAMES[gameType]}.</p>}
      </div>

      <div>
        <label htmlFor="eq-question" className="text-xs font-semibold tracking-wide text-muted uppercase">
          Question
        </label>
        <textarea
          id="eq-question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder={'e.g. "Brave" means—'}
          className={cx(inputClass, "mt-1.5 resize-none p-2.5")}
        />
      </div>

      <div className="grid gap-2.5" role="radiogroup" aria-label="Correct answer">
        {options.map((optionValue, index) => {
          const isCorrect = correctIndex === index;
          return (
            <div
              key={index}
              onClick={() => setCorrectIndex(index)}
              className={cx(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 transition-colors motion-safe:duration-150",
                isCorrect ? "border-green-500 bg-green-500/10" : "border-line bg-panel hover:border-accent hover:bg-soft",
              )}
            >
              <input
                type="radio"
                name="correctOption"
                checked={isCorrect}
                onChange={() => setCorrectIndex(index)}
                aria-label={`Mark option ${OPTION_LABELS[index]} as the correct answer`}
                className="size-5 shrink-0 cursor-pointer accent-green-600"
              />
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                  isCorrect ? "border-green-500 bg-green-500 text-white" : "border-line text-muted",
                )}
              >
                {OPTION_LABELS[index]}
              </span>
              <input
                value={optionValue}
                onChange={(event) =>
                  setOptions((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                }
                onClick={(event) => event.stopPropagation()}
                placeholder={`Option ${OPTION_LABELS[index]}`}
                maxLength={200}
                aria-label={`Option ${OPTION_LABELS[index]}`}
                className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted">Tap anywhere on an option row to mark it as the correct answer.</p>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <FixedButton variant="outline" type="button" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </FixedButton>
        <FixedButton variant="primary" type="submit" className="flex-1" loading={saving} disabled={saving}>
          {editing ? "Save changes" : "Add question"}
        </FixedButton>
      </div>
    </Card>
  );
}
