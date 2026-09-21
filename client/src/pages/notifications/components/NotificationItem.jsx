import Avatar from "../../../components/ui/Avatar";
import { cx } from "../../../utility/cx";
import { formatTime } from "../../../utility/helpers";

export default function NotificationItem({ notification, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(notification)}
      className={cx(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors motion-safe:duration-150",
        "hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        !notification.read && "bg-accent/5",
      )}
    >
      <Avatar person={notification.actor} size="md" />

      <div className="min-w-0 flex-1">
        <p
          className={cx(
            "text-sm leading-snug text-ink",
            !notification.read && "font-semibold",
          )}
        >
          {notification.payload?.message || notification.type}
        </p>
        <p className="mt-0.5 text-xs text-muted">{formatTime(notification.createdAt)}</p>
      </div>

      {!notification.read && (
        <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      )}
    </button>
  );
}
