import { Delete, MoreHoriz } from "@mui/icons-material";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import { cx } from "../../../utility/cx";
import { formatTime } from "../../../utility/helpers";

export default function NotificationItem({ notification, onClick, onDelete, deleting, deleteError }) {
  return (
    <div
      className={cx(
        "group relative flex w-full items-center gap-3 border-l-2 px-4 py-3.5 transition-colors motion-safe:duration-150",
        "hover:bg-soft",
        notification.read ? "border-l-transparent" : "border-l-accent bg-accent/8",
      )}
    >
      <button
        type="button"
        onClick={() => onClick(notification)}
        className={cx(
          "flex min-w-0 flex-1 items-center gap-3 rounded-md text-left",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
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
          {deleteError && <p className="mt-0.5 text-xs font-medium text-danger">{deleteError}</p>}
        </div>

        {!notification.read && (
          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        )}
      </button>

      <Menu
        align="end"
        trigger={
          <IconButton
            label="Notification options"
            icon={<MoreHoriz fontSize="small" />}
            size="sm"
            className="shrink-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          />
        }
        items={[
          {
            key: "delete",
            label: deleting ? "Deleting…" : "Delete",
            icon: <Delete fontSize="small" />,
            danger: true,
            onClick: () => !deleting && onDelete(notification),
          },
        ]}
      />
    </div>
  );
}
