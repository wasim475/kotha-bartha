import {
  ArrowBackRounded,
  Block,
  Call,
  Close,
  EditNote,
  EmojiEmotions,
  Info,
  MoreHoriz,
  Palette,
  Search,
  Videocam,
} from "@mui/icons-material";
import { Link } from "react-router-dom";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import { useCall } from "../../../provider/CallProvider";

// "last seen" wants a clock time (e.g. "last seen 12:10 pm"), not the
// relative "2 hours ago" phrasing utility/helpers.jsx's formatTime gives —
// that one is shared by message timestamps/notifications elsewhere and
// stays as-is; this is local to how presence reads in the chat header.
const formatLastSeen = (date) => {
  const seen = new Date(date);
  if (Number.isNaN(seen.getTime())) return "";
  const time = seen.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  if (seen.toDateString() === now.toDateString()) return `last seen ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (seen.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${seen.toLocaleDateString([], { day: "numeric", month: "short" })} at ${time}`;
};

const ChatHeader = ({
  selected,
  isGroup,
  groupDetail,
  onOpenGroupInfo,
  loading,
  onBack,
  isTyping,
  search,
  searchOpen,
  onToggleSearch,
  onSelectSearchResult,
  onOpenNickname,
  onOpenTheme,
  onOpenEmojiPack,
  onRequestBlock,
}) => {
  const call = useCall();
  const group = groupDetail?.data;
  const otherUser = !isGroup ? selected?.user : null;
  const displayName = otherUser?.nickname || otherUser?.fullName;
  const isBlocked = Boolean(otherUser?.isBlocked);
  const hasBlockedMe = Boolean(otherUser?.hasBlockedMe);
  const blocked = isBlocked || hasBlockedMe;
  const callBusy = call && call.status !== "idle";
  const placeCall = (video) => otherUser && !callBusy && call?.startCall(otherUser, { video });

  return (
    <div className="relative shrink-0 border-b border-line">
    <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
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
      ) : isGroup ? (
        <button
          type="button"
          onClick={onOpenGroupInfo}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar
            person={{
              fullName: group?.name,
              avatar: group?.avatar,
              initials: group?.name?.slice(0, 2),
            }}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{group?.name}</p>
            <p className="text-xs text-muted">{group?.memberCount || "…"} members</p>
          </div>
        </button>
      ) : (
        <Link
          to={`/app/profile/${selected.user.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
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
            <p className="truncate text-sm font-semibold text-ink hover:underline">
              {displayName}
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
                online
              </p>
            ) : selected.user.lastSeenAt ? (
              <p className="text-xs text-muted">
                {formatLastSeen(selected.user.lastSeenAt)}
              </p>
            ) : null}
          </div>
        </Link>
      )}

      {isGroup ? (
        <>
          <IconButton
            label="Group info"
            icon={<Info fontSize="small" />}
            size="sm"
            onClick={onOpenGroupInfo}
          />
          {selected && (
            <Menu
              align="end"
              trigger={
                <IconButton label="Conversation options" icon={<MoreHoriz fontSize="small" />} size="sm" />
              }
              items={[
                {
                  key: "search",
                  label: "Search Message",
                  icon: <Search fontSize="small" />,
                  onClick: onToggleSearch,
                },
              ]}
            />
          )}
        </>
      ) : (
        <>
          <IconButton
            label="Start voice call"
            icon={<Call fontSize="small" />}
            size="sm"
            disabled={!selected || blocked || callBusy}
            onClick={() => placeCall(false)}
          />
          <IconButton
            label="Start video call"
            icon={<Videocam fontSize="small" />}
            size="sm"
            disabled={!selected || blocked || callBusy}
            onClick={() => placeCall(true)}
          />
          {selected && (
            <Menu
              align="end"
              trigger={
                <IconButton label="Conversation options" icon={<MoreHoriz fontSize="small" />} size="sm" />
              }
              items={[
                {
                  key: "search",
                  label: "Search Message",
                  icon: <Search fontSize="small" />,
                  onClick: onToggleSearch,
                },
                {
                  key: "nickname",
                  label: "Set nickname",
                  icon: <EditNote fontSize="small" />,
                  onClick: onOpenNickname,
                },
                {
                  key: "theme",
                  label: "Change theme",
                  icon: <Palette fontSize="small" />,
                  onClick: onOpenTheme,
                },
                {
                  key: "emoji-pack",
                  label: "Emoji pack",
                  icon: <EmojiEmotions fontSize="small" />,
                  onClick: onOpenEmojiPack,
                },
                {
                  key: "block",
                  label: isBlocked ? "Unblock messages" : "Block messages",
                  icon: <Block fontSize="small" />,
                  danger: !isBlocked,
                  onClick: onRequestBlock,
                },
              ]}
            />
          )}
        </>
      )}
    </div>

    {searchOpen && (
      <div className="border-t border-line bg-panel px-3.5 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={search?.query || ""}
            onChange={(event) => search?.setQuery(event.target.value)}
            placeholder="Search this conversation…"
            className="w-full min-w-0 rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {search?.loading && <p className="mt-2 px-1 text-xs text-muted">Searching…</p>}
        {search?.error && <p className="mt-2 px-1 text-xs font-medium text-danger">{search.error}</p>}
        {!search?.loading &&
          !search?.error &&
          search?.query.trim() &&
          !search?.results.length && (
            <p className="mt-2 px-1 text-xs text-muted">No matches found.</p>
          )}
        {search?.results.length > 0 && (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-line">
            {search.results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelectSearchResult(result.id)}
                className="block w-full truncate px-2.5 py-2 text-left text-xs text-ink hover:bg-soft"
              >
                {result.body}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    </div>
  );
};

export default ChatHeader;
