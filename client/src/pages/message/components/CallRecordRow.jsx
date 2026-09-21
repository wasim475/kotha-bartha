import { Call, CallMissed } from "@mui/icons-material";

import { cx } from "../../../utility/cx";

const formatMessageTime = (date) => {
  if (!date) return "";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/**
 * Call log entry — a message-like record created once a call ends
 * (completed/missed/cancelled). Deliberately not a text bubble: no reply,
 * react, edit, or delete affordances, since none of those apply to it.
 */
export default function CallRecordRow({ message, isOwn, groupStart }) {
  const missed = message.call?.outcome !== "completed";
  const Icon = missed ? CallMissed : Call;

  return (
    <div className={cx("flex", groupStart ? "mt-3" : "mt-1", isOwn ? "justify-end" : "justify-start")}>
      <div
        data-call-record
        className={cx(
          "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium",
          missed
            ? "border-danger/25 bg-danger-soft text-danger"
            : "border-line bg-soft text-muted",
        )}
      >
        <Icon fontSize="small" />
        <span>{message.body}</span>
        <span className="text-[10px] opacity-70">{formatMessageTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
