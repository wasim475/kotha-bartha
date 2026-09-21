import { ArrowBackRounded, Call, CallEnd } from "@mui/icons-material";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import { formatTime } from "../../../utility/helpers";

const ChatHeader = ({
  selected,
  loading,
  onBack,
  callState,
  startCall,
  finishCall,
  isTyping,
}) => {
  const onCall = callState === "idle" ? startCall : () => finishCall();
  const inCall = callState !== "idle";

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-3.5 py-3 sm:px-4">
      <IconButton
        label="Back to conversations"
        icon={<ArrowBackRounded fontSize="small" />}
        size="sm"
        onClick={onBack}
        className="md:hidden"
      />

      {loading ? (
        <div className="flex min-w-0 flex-1 animate-pulse items-center gap-3 motion-reduce:animate-none">
          <div className="size-10 shrink-0 rounded-full bg-soft" />
          <div className="h-3 w-32 rounded bg-soft" />
        </div>
      ) : !selected ? (
        <p className="min-w-0 flex-1 text-sm text-muted">Conversation not found</p>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <Avatar person={selected.user} size="md" />
            {selected.user.isOnline && (
              <span
                className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-panel bg-emerald-500"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {selected.user.fullName}
            </p>
            {isTyping ? (
              <p className="flex items-center gap-1 text-xs font-medium text-accent">
                <span className="flex gap-0.5">
                  <span className="size-1 animate-bounce rounded-full bg-accent [animation-delay:-0.2s] motion-reduce:animate-none" />
                  <span className="size-1 animate-bounce rounded-full bg-accent [animation-delay:-0.1s] motion-reduce:animate-none" />
                  <span className="size-1 animate-bounce rounded-full bg-accent motion-reduce:animate-none" />
                </span>
                typing
              </p>
            ) : selected.user.isOnline ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Active now
              </p>
            ) : selected.user.lastSeenAt ? (
              <p className="text-xs text-muted">
                Active {formatTime(selected.user.lastSeenAt)}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <IconButton
        label={inCall ? "End voice call" : "Start voice call"}
        icon={inCall ? <CallEnd fontSize="small" /> : <Call fontSize="small" />}
        variant={inCall ? "danger" : "default"}
        size="sm"
        disabled={!selected}
        onClick={onCall}
      />
    </div>
  );
};

export default ChatHeader;
