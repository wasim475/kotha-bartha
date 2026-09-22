import {
  AdminPanelSettings,
  Close,
  Logout,
  PersonAdd,
  PersonRemove,
  PushPin,
} from "@mui/icons-material";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useRef, useState } from "react";

import Avatar from "../../../components/ui/Avatar";
import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import { api } from "../../../utility/api";
import useButtonColorFix from "../../../utility/useButtonColorFix";

export default function GroupInfoPanel({
  open,
  onClose,
  conversationId,
  groupDetail,
  currentUserId,
  onLeft,
  onJumpToMessage,
}) {
  const [adding, setAdding] = useState(false);
  const [unpinningId, setUnpinningId] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [leaving, setLeaving] = useState(false);
  const avatarInputRef = useRef(null);
  const dangerFix = useButtonColorFix("danger");

  const startRenaming = () => {
    if (!isAdmin) return;
    setRenaming(true);
    setNameDraft(detail?.name || "");
  };

  const detail = groupDetail?.data;
  const members = detail?.members || [];
  const isAdmin = members.find((member) => member.id === currentUserId)?.isAdmin;
  const pinnedMessages = detail?.pinnedMessagesDetail || [];

  const unpinMessage = async (messageId) => {
    setUnpinningId(messageId);
    setError("");
    try {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}/pin`);
      await groupDetail.reload();
    } catch (unpinError) {
      setError(unpinError.response?.data?.error?.message || "Couldn't unpin that message.");
    } finally {
      setUnpinningId(null);
    }
  };

  const runSearch = async (value) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    try {
      const { data } = await api.get("/users/search", { params: { q: value.trim() } });
      const memberIds = new Set(members.map((member) => member.id));
      setResults((data.data || []).filter((person) => !memberIds.has(person.id)));
    } catch {
      setResults([]);
    }
  };

  const addMember = async (personId) => {
    setBusyId(personId);
    setError("");
    try {
      await api.post(`/conversations/${conversationId}/members`, { memberIds: [personId] });
      await groupDetail.reload();
      setQuery("");
      setResults([]);
    } catch (addError) {
      setError(addError.response?.data?.error?.message || "Couldn't add that member.");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (personId) => {
    setBusyId(personId);
    setError("");
    try {
      await api.delete(`/conversations/${conversationId}/members/${personId}`);
      await groupDetail.reload();
    } catch (removeError) {
      setError(removeError.response?.data?.error?.message || "Couldn't remove that member.");
    } finally {
      setBusyId(null);
    }
  };

  const leaveGroup = async () => {
    setLeaving(true);
    setError("");
    try {
      await api.delete(`/conversations/${conversationId}/members/${currentUserId}`);
      onLeft();
    } catch (leaveError) {
      setError(leaveError.response?.data?.error?.message || "Couldn't leave the group.");
      setLeaving(false);
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim()) return;
    setError("");
    try {
      await api.patch(`/conversations/${conversationId}`, { groupName: nameDraft.trim() });
      await groupDetail.reload();
      setRenaming(false);
    } catch (renameError) {
      setError(renameError.response?.data?.error?.message || "Couldn't rename the group.");
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.patch(`/conversations/${conversationId}/avatar`, formData);
      await groupDetail.reload();
    } catch (avatarError) {
      setError(avatarError.response?.data?.error?.message || "Couldn't update the group photo.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition-opacity duration-150 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-lg border border-line bg-panel shadow-soft transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <DialogTitle className="font-display text-base font-semibold text-ink">
              Group info
            </DialogTitle>
            <IconButton label="Close" icon={<Close fontSize="small" />} size="sm" onClick={onClose} />
          </div>

          <div className="flex flex-col items-center gap-2 border-b border-line px-4 py-5">
            <button
              type="button"
              onClick={() => isAdmin && avatarInputRef.current?.click()}
              className="relative"
            >
              <Avatar
                person={{ fullName: detail?.name, avatar: detail?.avatar, initials: detail?.name?.slice(0, 2) }}
                size="xl"
              />
            </button>
            {isAdmin && (
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
              />
            )}

            {renaming ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  autoFocus
                  maxLength={80}
                  className="rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <Button size="sm" variant="primary" onClick={saveName}>
                  Save
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startRenaming}
                className="font-display text-lg font-semibold text-ink"
              >
                {detail?.name}
              </button>
            )}
            <p className="text-xs text-muted">{detail?.memberCount} members</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {isAdmin && (
              <div className="mb-2 border-b border-line px-2 pb-2">
                {adding ? (
                  <>
                    <input
                      value={query}
                      onChange={(event) => runSearch(event.target.value)}
                      placeholder="Search people to add…"
                      autoFocus
                      className="mb-1 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    {results.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        disabled={busyId === person.id}
                        onClick={() => addMember(person.id)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-soft"
                      >
                        <Avatar person={person} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{person.fullName}</span>
                        <PersonAdd fontSize="small" className="text-accent" />
                      </button>
                    ))}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-accent hover:bg-soft"
                  >
                    <PersonAdd fontSize="small" /> Add members
                  </button>
                )}
              </div>
            )}

            {pinnedMessages.length > 0 && (
              <div className="mb-2 border-b border-line px-2 pb-2">
                <p className="mb-1 flex items-center gap-1 px-1 text-xs font-semibold text-muted">
                  <PushPin fontSize="inherit" /> Pinned messages
                </p>
                {pinnedMessages.map((pin) => (
                  <div
                    key={pin.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-soft"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJumpToMessage?.(pin.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-xs font-medium text-ink">
                        {pin.senderName}
                      </span>
                      <span className="block truncate text-xs text-muted">{pin.body}</span>
                    </button>
                    <IconButton
                      label="Unpin message"
                      icon={<Close fontSize="small" />}
                      size="sm"
                      disabled={unpinningId === pin.id}
                      onClick={() => unpinMessage(pin.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5 rounded-md px-2 py-2">
                <Avatar person={member} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {member.fullName}
                  {member.id === currentUserId && " (you)"}
                </span>
                {member.isAdmin && (
                  <span className="flex items-center gap-0.5 rounded-full bg-soft px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    <AdminPanelSettings fontSize="inherit" /> Admin
                  </span>
                )}
                {isAdmin && !member.isAdmin && member.id !== currentUserId && (
                  <IconButton
                    label={`Remove ${member.fullName}`}
                    icon={<PersonRemove fontSize="small" />}
                    variant="danger"
                    size="sm"
                    disabled={busyId === member.id}
                    onClick={() => removeMember(member.id)}
                  />
                )}
              </div>
            ))}
          </div>

          {error && <p className="px-4 pb-2 text-xs font-medium text-danger">{error}</p>}

          <div className="border-t border-line px-4 py-3">
            <Button
              variant="danger"
              size="sm"
              loading={leaving}
              disabled={leaving}
              onClick={leaveGroup}
              style={dangerFix.style}
              onMouseEnter={dangerFix.onMouseEnter}
              onMouseLeave={dangerFix.onMouseLeave}
              className="w-full"
            >
              <Logout fontSize="small" /> Leave group
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
