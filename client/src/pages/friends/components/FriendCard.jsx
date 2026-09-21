import {
  Block,
  Check,
  ChatBubbleOutlineRounded,
  Close,
  MoreHoriz,
  PersonRemoveOutlined,
} from "@mui/icons-material";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import useButtonColorFix from "../../../utility/useButtonColorFix";

const subtitleFor = (tab, person) => {
  if (tab === "requests") return "Sent you a friend request";
  if (tab === "sent") return "Friend request sent";
  if (tab === "blocked") return "Blocked";
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
  onUnfriend,
  onBlock,
  onUnblock,
  onProfileClick,
}) => {
  const person = entry.user || entry;

  const acceptFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");

  const stop = (event) => event.stopPropagation();

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
            style={acceptFix.style}
            onMouseEnter={acceptFix.onMouseEnter}
            onMouseLeave={acceptFix.onMouseLeave}
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
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            {!acting && <Close fontSize="small" />}
            Cancel
          </Button>
        )}

        {tab === "blocked" && (
          <Button
            size="sm"
            variant="outline"
            loading={acting}
            disabled={acting}
            onClick={() => onUnblock(entry)}
            aria-label={`Unblock ${person.fullName}`}
            style={outlineFix.style}
            onMouseEnter={outlineFix.onMouseEnter}
            onMouseLeave={outlineFix.onMouseLeave}
          >
            Unblock
          </Button>
        )}

        {tab === "friends" && (
          <>
            <Button
              size="sm"
              variant="outline"
              loading={acting}
              disabled={acting}
              onClick={() => onMessage(entry)}
              aria-label={`Message ${person.fullName}`}
              style={outlineFix.style}
              onMouseEnter={outlineFix.onMouseEnter}
              onMouseLeave={outlineFix.onMouseLeave}
            >
              {!acting && <ChatBubbleOutlineRounded fontSize="small" />}
              Message
            </Button>

            <Menu
              align="end"
              trigger={
                <IconButton
                  label={`More actions for ${person.fullName}`}
                  icon={<MoreHoriz fontSize="small" />}
                  size="sm"
                  disabled={acting}
                />
              }
              items={[
                {
                  key: "unfriend",
                  label: "Unfriend",
                  icon: <PersonRemoveOutlined fontSize="small" />,
                  onClick: () => onUnfriend(entry),
                },
                {
                  key: "block",
                  label: "Block",
                  icon: <Block fontSize="small" />,
                  danger: true,
                  onClick: () => onBlock(entry),
                },
              ]}
            />
          </>
        )}
      </div>
    </Card>
  );
};

export default FriendCard;
