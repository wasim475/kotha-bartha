import { Close } from "@mui/icons-material";
import { useEffect } from "react";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import { cx } from "../../../utility/cx";
import useMountedTransition from "../../../utility/useMountedTransition";

function IncomingMessageToast({ toast, onDismiss, onOpen, onRemoved }) {
  const { shouldRender, visible } = useMountedTransition(!toast.closing, 200);

  useEffect(() => {
    if (!shouldRender) onRemoved(toast.id);
  }, [shouldRender, toast.id, onRemoved]);

  if (!shouldRender) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(toast)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(toast);
        }
      }}
      className={cx(
        "pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-line bg-panel p-3 text-left shadow-soft",
        "transition motion-safe:duration-200 ease-out",
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
      )}
    >
      <Avatar person={toast.sender} className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {toast.sender?.fullName || "New message"}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{toast.preview}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(toast);
          }}
          className="mt-1.5 text-xs font-semibold text-accent hover:underline"
        >
          Open chat
        </button>
      </div>

      <IconButton
        label="Dismiss"
        icon={<Close fontSize="small" />}
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss(toast.id);
        }}
      />
    </div>
  );
}

// Desktop-only floating stack of new-message toasts, fixed to the bottom
// right so it never overlaps the topbar's own notification affordances.
export default function IncomingMessagePopupStack({ toasts, onDismiss, onOpen, onRemoved }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 hidden flex-col gap-2 md:flex"
    >
      {toasts.map((toast) => (
        <IncomingMessageToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onOpen={onOpen}
          onRemoved={onRemoved}
        />
      ))}
    </div>
  );
}
