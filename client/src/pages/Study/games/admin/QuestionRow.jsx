import { Check, Edit } from "@mui/icons-material";
import { useState } from "react";

import Card from "../../../../components/ui/Card";
import { api } from "../../../../utility/api";
import { cx } from "../../../../utility/cx";
import FixedButton from "../components/FixedButton";

const OPTION_LABELS = ["A", "B", "C", "D"];

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * One English question in the management list: text, type, options (with the
 * correct one marked — this list only ever comes from the role-protected
 * endpoint), created date, active status, and the Edit / Enable-Disable actions.
 */
export default function QuestionRow({ question, onEdit, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleActive = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch(`/games/english-questions/${question.id}/active`, {
        active: !question.active,
      });
      onChanged(data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || "Couldn't update this question.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cx("flex min-w-0 flex-col gap-3", !question.active && "opacity-75")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="game-chip game-chip--tone">{question.typeLabel}</span>
        <span
          className={cx(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
            question.active
              ? "border-green-500/50 bg-green-500/10 text-ink"
              : "border-line bg-soft text-muted",
          )}
        >
          {question.active ? "Active" : "Inactive"}
        </span>
        <span className="ml-auto text-[11px] text-muted">Added {formatDate(question.createdAt)}</span>
      </div>

      <p className="text-sm leading-snug font-semibold break-words text-ink">{question.question}</p>

      <ul className="grid gap-1.5 min-[480px]:grid-cols-2">
        {question.options.map((option, index) => {
          const correct = index === question.correctIndex;
          return (
            <li
              key={index}
              className={cx(
                "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                correct ? "border-green-500/60 bg-green-500/10 font-semibold text-ink" : "border-line text-muted",
              )}
            >
              <span className="font-bold">{OPTION_LABELS[index]}.</span>
              <span className="min-w-0 flex-1 break-words">{option}</span>
              {correct && <Check style={{ fontSize: 15 }} aria-label="Correct answer" />}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <FixedButton variant="outline" size="sm" onClick={() => onEdit(question)} disabled={busy}>
          <Edit style={{ fontSize: 15 }} /> Edit
        </FixedButton>
        <FixedButton variant="outline" size="sm" onClick={toggleActive} loading={busy} disabled={busy}>
          {question.active ? "Disable" : "Enable"}
        </FixedButton>
      </div>
    </Card>
  );
}
