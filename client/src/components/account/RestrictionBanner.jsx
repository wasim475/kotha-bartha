import { GppMaybeOutlined } from "@mui/icons-material";
import { useEffect, useState } from "react";

import { RESTRICTION_EVENT } from "../../utility/restriction";
import ContactAdminModal from "./ContactAdminModal";

/**
 * Tells a banned or muted person plainly what state their account is in, with a way
 * to write to the administrators. It reads the account state the server sent, and
 * also appears at once if the server refuses an action with ACCOUNT_RESTRICTED /
 * ACCOUNT_MUTED (a ban that happened after the page loaded). The server is what
 * actually blocks the actions — this is only the explanation.
 */
export default function RestrictionBanner({ user }) {
  const initial = user.accountStatus === "banned" ? "banned" : user.isMuted ? "muted" : null;
  const [state, setState] = useState(initial);
  const [contact, setContact] = useState(false);

  useEffect(() => {
    const onRestricted = (event) => setState((current) => (current === "banned" ? current : event.detail.reason));
    window.addEventListener(RESTRICTION_EVENT, onRestricted);
    return () => window.removeEventListener(RESTRICTION_EVENT, onRestricted);
  }, []);

  if (!state) return null;
  const banned = state === "banned";

  return (
    <>
      <div
        role="status"
        data-testid="restriction-banner"
        data-state={state}
        className="fixed inset-x-3 bottom-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-panel p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] sm:bottom-4"
        style={{ borderColor: banned ? "var(--danger)" : undefined }}
      >
        <GppMaybeOutlined className={banned ? "text-danger" : "text-amber-500"} />
        <p className="min-w-0 flex-1 text-xs leading-snug font-semibold text-ink">
          {banned ? "Your account is currently restricted." : "Your account is currently muted."}
          <span className="block font-normal text-muted">{banned ? "You can browse, but can't post, comment, react, message or play." : "You can browse, but can't post, comment or message."}</span>
        </p>
        <button type="button" onClick={() => setContact(true)} className="min-h-10 shrink-0 rounded-md border border-line px-3 text-xs font-semibold text-accent hover:bg-soft">
          Contact admin
        </button>
      </div>
      <ContactAdminModal open={contact} onClose={() => setContact(false)} />
    </>
  );
}
