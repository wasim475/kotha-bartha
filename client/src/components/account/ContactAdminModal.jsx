import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { CheckCircleOutlined } from "@mui/icons-material";
import { useState } from "react";

import { api } from "../../utility/api";
import Button from "../ui/Button";
import useButtonColorFix from "../../utility/useButtonColorFix";

const CATEGORIES = [
  ["general", "General issue"],
  ["user", "A user"],
  ["post", "A post"],
  ["comment", "A comment"],
  ["reply", "A reply"],
];

function Body({ onClose, defaultCategory, reportId, targetType, targetId }) {
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const primaryFix = useButtonColorFix("primary");
  const ghostFix = useButtonColorFix("ghost");

  const send = async () => {
    if (busy || done || text.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/support/messages", { category, subject: subject.trim(), body: text.trim(), reportId, targetType, targetId });
      setDone(true);
    } catch (failure) {
      setError(failure.response?.data?.error?.message || "Couldn't send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogPanel transition className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:translate-y-3 data-[closed]:opacity-0" data-testid="contact-admin">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <CheckCircleOutlined className="text-green-500" fontSize="large" />
          <DialogTitle className="font-display text-lg font-semibold text-ink">Message sent.</DialogTitle>
          <p className="text-sm text-muted">The administrators will reply in your Messages.</p>
          <Button variant="primary" size="sm" className="min-h-10" onClick={onClose} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <DialogTitle className="font-display text-lg font-semibold text-ink">Contact the administrators</DialogTitle>
          <label className="mt-3 block text-xs font-semibold text-muted">
            What is it about?
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold text-muted">
            Subject (optional)
            <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-muted">
            Your message
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={4} className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="min-h-10" onClick={onClose} disabled={busy} style={ghostFix.style} onMouseEnter={ghostFix.onMouseEnter} onMouseLeave={ghostFix.onMouseLeave}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="min-h-10" loading={busy} disabled={busy || text.trim().length < 3} onClick={send} style={primaryFix.style} onMouseEnter={primaryFix.onMouseEnter} onMouseLeave={primaryFix.onMouseLeave}>
              Send
            </Button>
          </div>
        </>
      )}
    </DialogPanel>
  );
}

/** A user's message to the administrators (a complaint, question or appeal). */
export default function ContactAdminModal({ open, onClose, defaultCategory = "general", reportId, targetType, targetId }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[70]">
      <DialogBackdrop transition className="fixed inset-0 bg-black/45 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">{open && <Body onClose={onClose} defaultCategory={defaultCategory} reportId={reportId} targetType={targetType} targetId={targetId} />}</div>
    </Dialog>
  );
}
