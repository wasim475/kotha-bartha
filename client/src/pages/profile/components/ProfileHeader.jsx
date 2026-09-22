import {
  Block,
  Check,
  ChatBubbleOutlineRounded,
  MoreHoriz,
  PersonAddAlt1,
  PersonRemoveOutlined,
  PhotoCamera,
} from "@mui/icons-material";
import { useRef } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import Menu from "../../../components/ui/Menu";
import RichText from "../../../components/ui/RichText";
import useButtonColorFix from "../../../utility/useButtonColorFix";

function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none">
      <div className="h-40 rounded-t-lg bg-soft sm:h-56" />
      <div className="px-4 pb-4 sm:px-6">
        <div className="-mt-12 size-24 rounded-full border-4 border-panel bg-line sm:-mt-14 sm:size-32" />
        <div className="mt-3 h-5 w-40 rounded bg-soft" />
        <div className="mt-2 h-3.5 w-56 rounded bg-soft" />
      </div>
    </div>
  );
}

export default function ProfileHeader({
  person,
  own,
  busy,
  friendRequestReceived,
  onAcceptRequest,
  onAddFriend,
  onCancelRequest,
  onMessage,
  onEditProfile,
  onRequestUnfriend,
  onRequestBlock,
  onUnblock,
  onUploadAvatar,
  onUploadCover,
  avatarUploading,
  coverUploading,
  uploadError,
  loading,
}) {
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const primaryFix = useButtonColorFix("primary");
  const outlineFix = useButtonColorFix("outline");
  const dangerFix = useButtonColorFix("danger");

  if (loading) return <ProfileHeaderSkeleton />;
  if (!person) return null;

  return (
    <div>
      <div className="relative h-40 overflow-hidden rounded-t-lg bg-linear-to-br from-accent/25 to-accent/5 sm:h-56">
        {person.cover?.secureUrl && (
          <img src={person.cover.secureUrl} alt="" className="size-full object-cover" />
        )}
        {coverUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-xs font-semibold text-white">Uploading cover…</span>
          </div>
        )}
        {own && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => onUploadCover(event.target.files?.[0])}
            />
            <IconButton
              label="Change cover photo"
              icon={<PhotoCamera fontSize="small" />}
              onClick={() => coverInputRef.current?.click()}
              className="absolute right-3 bottom-3 bg-black/50 text-white hover:bg-black/70 hover:text-white"
            />
          </>
        )}
      </div>

      <div className="border-x border-b border-line bg-panel px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="relative -mt-12 sm:-mt-14">
            <Avatar
              person={person}
              size="xl"
              className="size-24 border-4 border-panel sm:size-32"
            />
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <span className="text-[10px] font-semibold text-white">Uploading…</span>
              </div>
            )}
            {own && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => onUploadAvatar(event.target.files?.[0])}
                />
                <IconButton
                  label="Change profile photo"
                  icon={<PhotoCamera fontSize="small" />}
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute right-0 bottom-0 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {own ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditProfile}
                style={outlineFix.style}
                onMouseEnter={outlineFix.onMouseEnter}
                onMouseLeave={outlineFix.onMouseLeave}
              >
                Edit profile
              </Button>
            ) : person.hasBlockedMe ? null : person.isBlocked ? (
              <Button
                variant="outline"
                size="sm"
                loading={busy === "unblock"}
                disabled={busy === "unblock"}
                onClick={onUnblock}
                style={outlineFix.style}
                onMouseEnter={outlineFix.onMouseEnter}
                onMouseLeave={outlineFix.onMouseLeave}
              >
                Unblock
              </Button>
            ) : (
              <>
                {friendRequestReceived ? (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === "friend"}
                    disabled={busy === "friend"}
                    onClick={onAcceptRequest}
                    style={primaryFix.style}
                    onMouseEnter={primaryFix.onMouseEnter}
                    onMouseLeave={primaryFix.onMouseLeave}
                  >
                    <Check fontSize="small" /> Accept request
                  </Button>
                ) : person.isFriend ? (
                  <Button variant="outline" size="sm" disabled className="opacity-100">
                    <Check fontSize="small" /> Friends
                  </Button>
                ) : person.friendRequestSent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busy === "cancel"}
                    disabled={busy === "cancel"}
                    onClick={onCancelRequest}
                    style={outlineFix.style}
                    onMouseEnter={outlineFix.onMouseEnter}
                    onMouseLeave={outlineFix.onMouseLeave}
                  >
                    Request sent
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === "friend"}
                    disabled={busy === "friend"}
                    onClick={onAddFriend}
                    style={primaryFix.style}
                    onMouseEnter={primaryFix.onMouseEnter}
                    onMouseLeave={primaryFix.onMouseLeave}
                  >
                    <PersonAddAlt1 fontSize="small" /> Add friend
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === "message"}
                  disabled={busy === "message"}
                  onClick={onMessage}
                  style={outlineFix.style}
                  onMouseEnter={outlineFix.onMouseEnter}
                  onMouseLeave={outlineFix.onMouseLeave}
                >
                  <ChatBubbleOutlineRounded fontSize="small" /> Message
                </Button>

                {person.isFriend ? (
                  <Menu
                    align="end"
                    trigger={
                      <IconButton
                        label="More profile actions"
                        icon={<MoreHoriz fontSize="small" />}
                      />
                    }
                    items={[
                      {
                        key: "unfriend",
                        label: "Unfriend",
                        icon: <PersonRemoveOutlined fontSize="small" />,
                        onClick: onRequestUnfriend,
                      },
                      {
                        key: "block",
                        label: "Block",
                        icon: <Block fontSize="small" />,
                        danger: true,
                        onClick: onRequestBlock,
                      },
                    ]}
                  />
                ) : (
                  <IconButton
                    label={`Block ${person.fullName}`}
                    icon={<Block fontSize="small" />}
                    variant="danger"
                    onClick={onRequestBlock}
                    style={dangerFix.style}
                    onMouseEnter={dangerFix.onMouseEnter}
                    onMouseLeave={dangerFix.onMouseLeave}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-[28px]">
          {person.fullName}
        </h1>
        {person.bio && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            <RichText text={person.bio} />
          </p>
        )}
        <p className="mt-1.5 text-xs font-medium text-muted">
          {person.friendCount} {person.friendCount === 1 ? "friend" : "friends"}
        </p>

        {person.hasBlockedMe && (
          <p className="mt-3 rounded-md bg-soft px-3 py-2 text-xs font-medium text-muted">
            You can't interact with this profile.
          </p>
        )}
        {uploadError && (
          <p className="mt-3 text-xs font-medium text-danger">{uploadError}</p>
        )}
      </div>
    </div>
  );
}
