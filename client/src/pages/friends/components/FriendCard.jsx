import { Check, ChatBubbleOutlineRounded, Close } from "@mui/icons-material";
import { useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";

const subtitleFor = (tab, person) => {
  if (tab === "requests") return "Sent you a friend request";
  if (tab === "sent") return "Friend request sent";
  return person.bio?.trim() || "Friend";
};

const FriendCard = ({
  entry,
  tab,
  acting = false,
  error = "",
  onAccept,
  onCancel,
  onMessage,
  onProfileClick,
}) => {
  const person = entry.user || entry;
  const [hover, setHover] = useState(false);

  const stop = (event) => event.stopPropagation();

  // The shared Button component's `primary`/`outline` colors are silently
  // defeated by a pre-existing, app-wide App.css rule — an unscoped
  // `button { background: transparent; color: inherit }` reset that isn't
  // wrapped in a Tailwind layer, so it beats `bg-accent`/`text-white` etc.
  // on every button in the app (confirmed on Feed's own buttons too, not
  // something this change introduced). Fixing that reset is out of scope
  // for a Friends-only change, so these inline styles restore the intended
  // look for just these three actions without touching the shared file.
  const hoverHandlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  const primaryStyle = {
    backgroundColor: hover ? "var(--accent-deep)" : "var(--accent)",
    color: "#fff",
  };
  const outlineStyle = {
    backgroundColor: hover ? "var(--soft)" : "var(--panel)",
    color: "var(--ink)",
    borderColor: "var(--line)",
  };

  return (
    <Card
      interactive
      padded={false}
      className="flex items-center gap-3 p-3 sm:gap-3.5 sm:p-3.5"
    >
      <button
        type="button"
        onClick={() => onProfileClick(person.id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-3.5"
      >
        <Avatar person={person} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{person.fullName}</p>
          <p className="truncate text-xs text-muted">{subtitleFor(tab, person)}</p>
          {error && <p className="mt-0.5 text-xs font-medium text-danger">{error}</p>}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5" onClick={stop}>
        {tab === "requests" && (
          <Button
            size="sm"
            variant="primary"
            loading={acting}
            disabled={acting}
            onClick={() => onAccept(entry)}
            aria-label={`Accept ${person.fullName}'s friend request`}
            style={primaryStyle}
            {...hoverHandlers}
          >
            {!acting && <Check fontSize="small" />}
            Accept
          </Button>
        )}

        {tab === "sent" && (
          <Button
            size="sm"
            variant="outline"
            loading={acting}
            disabled={acting}
            onClick={() => onCancel(entry)}
            aria-label={`Cancel friend request to ${person.fullName}`}
            style={outlineStyle}
            {...hoverHandlers}
          >
            {!acting && <Close fontSize="small" />}
            Cancel
          </Button>
        )}

        {tab === "friends" && (
          <Button
            size="sm"
            variant="outline"
            loading={acting}
            disabled={acting}
            onClick={() => onMessage(entry)}
            aria-label={`Message ${person.fullName}`}
            style={outlineStyle}
            {...hoverHandlers}
          >
            {!acting && <ChatBubbleOutlineRounded fontSize="small" />}
            Message
          </Button>
        )}
      </div>
    </Card>
  );
};

export default FriendCard;
