import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

import useAdminAction from "../../hooks/admin/useAdminAction";
import useAdminQuery from "../../hooks/admin/useAdminQuery";
import useDebounced from "../../hooks/admin/useDebounced";
import Avatar from "../ui/Avatar";
import AdminButton from "./AdminButton";

function Body({ recipient: initial, reportId, onClose, onSent }) {
  const [recipient, setRecipient] = useState(initial || null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const term = useDebounced(search.trim(), 350);
  const results = useAdminQuery("/admin/users", { q: term }, { enabled: !recipient && term.length >= 2 });
  const action = useAdminAction();

  const send = async () => {
    const result = await action.run("POST", "/admin/messages", { userId: recipient.id, body: text, reportId });
    if (result) {
      setSent(true);
      onSent?.();
    }
  };

  return (
    <DialogPanel transition className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-soft transition duration-150 data-[closed]:translate-y-3 data-[closed]:opacity-0" data-testid="admin-compose">
      <DialogTitle className="font-display text-lg font-semibold text-ink">Message a user</DialogTitle>
      <p className="mt-1 text-xs text-muted">It arrives in their normal Inbox, marked as coming from the Administration.</p>

      {sent ? (
        <div className="mt-5 flex flex-col items-center gap-3 py-4 text-center" role="status">
          <p className="text-sm font-semibold text-ink">Message sent to {recipient.fullName}.</p>
          <AdminButton onClick={onClose}>Done</AdminButton>
        </div>
      ) : (
        <>
          {recipient ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-line bg-soft p-2.5">
              <Avatar person={recipient} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{recipient.fullName}</span>
              {!initial && (
                <button type="button" className="text-xs font-semibold text-accent" onClick={() => setRecipient(null)}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search a user by name or email…"
                aria-label="Search users"
                className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                {(results.data?.users || []).slice(0, 8).map((user) => (
                  <li key={user.id}>
                    <button type="button" onClick={() => setRecipient(user)} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-soft">
                      <Avatar person={user} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{user.fullName}</span>
                        <span className="block truncate text-xs text-muted">{user.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {results.data && !results.data.users.length && <li className="px-2 py-3 text-center text-xs text-muted">No matching users.</li>}
              </ul>
            </div>
          )}

          <label className="mt-4 block text-xs font-semibold text-muted">
            Message
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          {action.error && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {action.error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <AdminButton variant="ghost" className="min-h-10" onClick={onClose} disabled={action.busy}>
              Cancel
            </AdminButton>
            <AdminButton className="min-h-10" loading={action.busy} disabled={action.busy || !recipient || !text.trim()} onClick={send}>
              Send message
            </AdminButton>
          </div>
        </>
      )}
    </DialogPanel>
  );
}

/** Admin → user message (picks a recipient unless one is given). */
export default function AdminComposeDialog({ open, recipient, reportId, onClose, onSent }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-black/45 transition-opacity duration-150 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">{open && <Body recipient={recipient} reportId={reportId} onClose={onClose} onSent={onSent} />}</div>
    </Dialog>
  );
}
