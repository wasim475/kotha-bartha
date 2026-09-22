import {
  AttachFile,
  Close,
  Delete,
  EmojiEmotions,
  Mic,
  Send,
} from "@mui/icons-material";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import useButtonColorFix from "../../../utility/useButtonColorFix";
import useVoiceRecorder from "../hooks/useVoiceRecorder";

const MENTION_TOKEN = /(?:^|\s)@(\w*)$/;

const formatRecordingTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const MessageComposer = ({
  body,
  setBody,
  sending,
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
  onSendAttachment,
  groupMembers = [],
  mentionIds = [],
  setMentionIds,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const emojiWrapperRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendFix = useButtonColorFix("primary");

  const mentionMatches =
    mentionQuery === null
      ? []
      : groupMembers.filter((member) =>
          member.fullName.toLowerCase().includes(mentionQuery.toLowerCase()),
        );

  const pickMention = (member) => {
    const textarea = textareaRef.current;
    const cursor = textarea ? textarea.selectionStart : body.length;
    const before = body.slice(0, cursor).replace(MENTION_TOKEN, (full) =>
      full.startsWith(" ") ? ` @${member.fullName} ` : `@${member.fullName} `,
    );
    const after = body.slice(cursor);
    setBody(before + after);
    setMentionIds?.((current) => (current.includes(member.id) ? current : [...current, member.id]));
    setMentionQuery(null);
    textarea?.focus();
  };

  const recorder = useVoiceRecorder({
    onRecorded: (blob, durationSec) => {
      const file = new File([blob], `voice-note.webm`, {
        type: blob.type || "audio/webm",
      });
      onSendAttachment(file, { durationSec });
    },
  });

  const addEmoji = (emoji) => {
    setBody((current) => `${current}${emoji}`);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (!showEmojiPicker) return undefined;

    const handleOutsideClick = (event) => {
      if (!emojiWrapperRef.current?.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [body]);

  const submit = (event) => {
    event?.preventDefault?.();
    onSend(event || { preventDefault: () => {} });
  };

  return (
    <div className="shrink-0 border-t border-line bg-panel">
      {replyingTo && (
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 border-b border-line bg-soft px-3.5 py-2 text-xs text-muted sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
            <span className="block truncate">Replying to: {replyingTo.body}</span>
          </div>
          <IconButton
            label="Cancel reply"
            icon={<Close fontSize="small" />}
            size="sm"
            onClick={onCancelReply}
          />
        </div>
      )}

      {recorder.recording ? (
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 p-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-10">
          <IconButton
            label="Cancel recording"
            icon={<Delete fontSize="small" />}
            variant="danger"
            onClick={recorder.cancel}
          />
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-paper px-3.5 py-2">
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
            <span className="text-sm font-medium text-ink">Recording…</span>
            <span className="ml-auto text-sm tabular-nums text-muted">
              {formatRecordingTime(recorder.seconds)}
            </span>
          </div>
          <button
            type="button"
            aria-label="Send voice message"
            onClick={recorder.stop}
            style={sendFix.style}
            onMouseEnter={sendFix.onMouseEnter}
            onMouseLeave={sendFix.onMouseLeave}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm transition-colors motion-safe:duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Send fontSize="small" />
          </button>
        </div>
      ) : (
        <form
          className="mx-auto flex w-full max-w-4xl items-end gap-1.5 p-2.5 sm:gap-2 sm:px-6 sm:py-3 lg:px-10"
          onSubmit={submit}
        >
          <div className="relative shrink-0" ref={emojiWrapperRef}>
            <IconButton
              label="Choose emoji"
              icon={<EmojiEmotions fontSize="small" />}
              active={showEmojiPicker}
              onClick={() => setShowEmojiPicker((current) => !current)}
            />

            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 z-40 mb-2 overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
                <EmojiPicker
                  onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                  width={300}
                  height={360}
                  searchDisabled={false}
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>

          <IconButton
            label="Attach a file"
            icon={<AttachFile fontSize="small" />}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onSendAttachment(file);
            }}
          />

          <div className="relative min-w-0 flex-1">
            {mentionQuery !== null && mentionMatches.length > 0 && (
              <div className="absolute bottom-full left-0 z-40 mb-2 max-h-48 w-56 overflow-y-auto rounded-xl border border-line bg-panel shadow-soft">
                {mentionMatches.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => pickMention(member)}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-soft"
                  >
                    <Avatar person={member} size="sm" />
                    <span className="truncate text-sm text-ink">{member.fullName}</span>
                    {mentionIds.includes(member.id) && (
                      <span className="ml-auto text-[10px] font-semibold text-accent">mentioned</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={body}
              rows={1}
              onChange={(event) => {
                const value = event.target.value;
                setBody(value);
                onTyping(value);
                if (groupMembers.length) {
                  const before = value.slice(0, event.target.selectionStart);
                  const match = before.match(MENTION_TOKEN);
                  setMentionQuery(match ? match[1] : null);
                } else {
                  setMentionQuery(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && mentionQuery !== null) {
                  setMentionQuery(null);
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Write a message…"
              autoFocus
              className="min-h-9 max-h-30 w-full resize-none rounded-2xl border border-line bg-paper px-3.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {body.trim() ? (
            <button
              type="submit"
              disabled={sending}
              aria-label={sending ? "Sending message" : "Send message"}
              style={sendFix.style}
              onMouseEnter={sendFix.onMouseEnter}
              onMouseLeave={sendFix.onMouseLeave}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Send fontSize="small" />
            </button>
          ) : (
            <IconButton
              label="Record a voice message"
              icon={<Mic fontSize="small" />}
              disabled={sending}
              onClick={recorder.start}
            />
          )}
        </form>
      )}
    </div>
  );
};

export default MessageComposer;
