import {
  ArrowBackRounded,
  Block,
  Call,
  CallEnd,
  Close,
  EditNote,
  EmojiEmotions,
  Info,
  MoreHoriz,
  Palette,
  Search,
} from "@mui/icons-material";
import { Link } from "react-router-dom";

import Avatar from "../../../components/ui/Avatar";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import { formatTime } from "../../../utility/helpers";

const ChatHeader = ({
  selected,
  isGroup,
  groupDetail,
  onOpenGroupInfo,
  loading,
  onBack,
  callState,
  startCall,
  finishCall,
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
  const onCall = callState === "idle" ? startCall : () => finishCall();
  const inCall = callState !== "idle";
  const group = groupDetail?.data;
  const otherUser = !isGroup ? selected?.user : null;
  const displayName = otherUser?.nickname || otherUser?.fullName;
  const isBlocked = Boolean(otherUser?.isBlocked);
  const hasBlockedMe = Boolean(otherUser?.hasBlockedMe);
  const blocked = isBlocked || hasBlockedMe;

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
                Active now
              </p>
            ) : selected.user.lastSeenAt ? (
              <p className="text-xs text-muted">
                Active {formatTime(selected.user.lastSeenAt)}
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
            label={inCall ? "End voice call" : "Start voice call"}
            icon={inCall ? <CallEnd fontSize="small" /> : <Call fontSize="small" />}
            variant={inCall ? "danger" : "default"}
            size="sm"
            disabled={!selected || blocked}
            onClick={onCall}
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
