import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { CheckCircleOutlined } from "@mui/icons-material";
import { useState } from "react";

import { api } from "../../utility/api";
import { cx } from "../../utility/cx";
import Button from "../ui/Button";
import useButtonColorFix from "../../utility/useButtonColorFix";

const REPORT_REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["inappropriate", "Inappropriate content"],
  ["hate", "Hate/abusive content"],
  ["scam", "Scam/fraud"],
  ["other", "Other"],
];

const TARGET_LABEL = { user: "user", post: "post", comment: "comment", reply: "reply" };

function Body({ targetType, targetId, onClose }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const primaryFix = useButtonColorFix("primary");
  const ghostFix = useButtonColorFix("ghost");
  const other = reason === "other";
  const ready = reason && (!other || description.trim().length >= 3);

  const submit = async () => {
    if (busy || done || !ready) return; // one submission only, however many clicks
    setBusy(true);
    setError("");
    try {
      await api.post("/reports", { targetType, targetId, reason, description: other ? description.trim() : description.trim() || undefined });
      setDone(true);
    } catch (failure) {
      setError(failure.response?.data?.error?.message || "Couldn't send the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogPanel transition className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:translate-y-3 data-[closed]:opacity-0" data-testid="report-modal">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <CheckCircleOutlined className="text-green-500" fontSize="large" />
          <DialogTitle className="font-display text-lg font-semibold text-ink">Report submitted.</DialogTitle>
          <p className="text-sm text-muted">Thank you. Our team will look into it.</p>
          <Button variant="primary" size="sm" className="min-h-10" onClick={onClose} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <DialogTitle className="font-display text-lg font-semibold text-ink">Report this {TARGET_LABEL[targetType]}</DialogTitle>
          <p className="mt-1 text-xs text-muted">Why are you reporting it?</p>
          <div className="mt-3 flex flex-col gap-1.5" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={reason === key}
                onClick={() => setReason(key)}
                className={cx("flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-sm font-medium transition-colors", reason === key ? "border-accent bg-accent/10 text-ink" : "border-line bg-panel text-ink hover:bg-soft")}
              >
                <span className={cx("grid size-4 shrink-0 place-items-center rounded-full border-2", reason === key ? "border-accent" : "border-line")} aria-hidden="true">
                  {reason === key && <span className="size-2 rounded-full bg-accent" />}
                </span>
                {label}
              </button>
            ))}
          </div>
          {other && (
            <label className="mt-3 block text-xs font-semibold text-muted">
              Tell us what happened
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            </label>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs font-medium text-danger">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="min-h-10" onClick={onClose} disabled={busy} style={ghostFix.style} onMouseEnter={ghostFix.onMouseEnter} onMouseLeave={ghostFix.onMouseLeave}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="min-h-10" loading={busy} disabled={busy || !ready} onClick={submit} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave}>
              Submit report
            </Button>
          </div>
        </>
      )}
    </DialogPanel>
  );
}

/**
 * THE report dialog, used for users, posts, comments and replies alike. The reporter
 * only picks a reason; the server works out who wrote the content and where it lives.
 */
export default function ReportModal({ open, targetType, targetId, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop transition className="fixed inset-0 bg-black/45 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">{open && <Body targetType={targetType} targetId={targetId} onClose={onClose} />}</div>
    </Dialog>
  );
}
