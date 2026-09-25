import { Block, DeleteForever, LockOpen, MailOutlined, Person, RemoveModerator, VolumeOff, VolumeUp, AddModerator } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import useAdminAction from "../../hooks/admin/useAdminAction";
import AdminConfirmDialog from "./AdminConfirmDialog";

// What each confirmation says and which request it sends. The server re-checks
// every rule (who may act on whom); this only words the warning and picks the call.
const CONFIRMS = {
  ban: (u) => ({
    title: `Ban ${u.fullName}?`,
    description: "They can still sign in and browse, but can't post, comment, react, message, add friends, play or edit their profile. Their posts, comments and replies are hidden — and come back if you unban them.",
    label: "Ban user",
    variant: "danger",
    reasonLabel: "Reason (optional, kept in the audit log)",
    request: (reason) => ["PATCH", `/admin/users/${u.id}/ban`, { banned: true, reason }],
  }),
  unban: (u) => ({
    title: `Unban ${u.fullName}?`,
    description: "Their account becomes active again and everything the ban hid is restored. Anything that was deleted individually stays deleted.",
    label: "Unban user",
    variant: "primary",
    request: () => ["PATCH", `/admin/users/${u.id}/ban`, { banned: false }],
  }),
  mute: (u) => ({
    title: `Mute ${u.fullName}?`,
    description: "They can browse and react, but can't create posts, comment, reply, send messages or friend requests, or play interactive games.",
    label: "Mute user",
    variant: "danger",
    reasonLabel: "Reason (optional)",
    request: (reason) => ["PATCH", `/admin/users/${u.id}/mute`, { muted: true, reason }],
  }),
  unmute: (u) => ({
    title: `Unmute ${u.fullName}?`,
    description: "Their normal permissions return.",
    label: "Unmute user",
    variant: "primary",
    request: () => ["PATCH", `/admin/users/${u.id}/mute`, { muted: false }],
  }),
  makeModerator: (u) => ({
    title: `Make ${u.fullName} a moderator?`,
    description: "Moderators can author Quiz and Game content. They get no other admin access.",
    label: "Make moderator",
    variant: "primary",
    request: () => ["PATCH", `/admin/users/${u.id}/role`, { role: "moderator" }],
  }),
  removeModerator: (u) => ({
    title: `Remove moderator role from ${u.fullName}?`,
    description: "They go back to being a regular user.",
    label: "Remove moderator",
    variant: "danger",
    request: () => ["PATCH", `/admin/users/${u.id}/role`, { role: "user" }],
  }),
  delete: (u) => ({
    title: `Delete ${u.fullName} permanently?`,
    description:
      "This permanently deletes the account and cannot be undone. Their posts, comments, replies, reactions, friendships, stories and notes are removed. Messages already sent, quiz and game history and audit records are kept under an anonymous “Deleted user”.",
    label: "Delete permanently",
    variant: "danger",
    typedWord: "DELETE",
    request: () => ["DELETE", `/admin/users/${u.id}`, { confirm: true }],
  }),
};

/**
 * The moderation actions on a user, shared by the users table and the user detail
 * page: `itemsFor(user)` gives the menu entries (only the ones that make sense for
 * that account) and `dialog` is the confirmation to render once. Nothing runs until
 * the admin confirms; the server enforces who may be acted on.
 */
export default function useUserActions({ me, isAdmin, onChanged, onMessage }) {
  const navigate = useNavigate();
  const action = useAdminAction();
  const [pending, setPending] = useState(null);

  const itemsFor = (user, { includeView = true } = {}) => {
    const items = [];
    if (includeView) items.push({ key: "view", label: "View", icon: <Person fontSize="small" />, onClick: () => navigate(`/admin/users/${user.id}`) });
    if (onMessage && user.accountStatus !== "deleted") items.push({ key: "message", label: "Send message", icon: <MailOutlined fontSize="small" />, onClick: () => onMessage(user) });
    const protectedAccount = user.role === "admin" || user.id === me?.id || user.accountStatus === "deleted";
    if (!isAdmin || protectedAccount) return items;

    const open = (kind) => () => {
      action.clearError();
      setPending({ kind, user });
    };
    items.push(
      user.role === "moderator"
        ? { key: "role", label: "Remove Moderator", icon: <RemoveModerator fontSize="small" />, onClick: open("removeModerator") }
        : { key: "role", label: "Make Moderator", icon: <AddModerator fontSize="small" />, onClick: open("makeModerator") },
      user.accountStatus === "banned"
        ? { key: "ban", label: "Unban", icon: <LockOpen fontSize="small" />, onClick: open("unban") }
        : { key: "ban", label: "Ban", icon: <Block fontSize="small" />, danger: true, onClick: open("ban") },
      user.isMuted
        ? { key: "mute", label: "Unmute", icon: <VolumeUp fontSize="small" />, onClick: open("unmute") }
        : { key: "mute", label: "Mute", icon: <VolumeOff fontSize="small" />, danger: true, onClick: open("mute") },
      { key: "delete", label: "Delete", icon: <DeleteForever fontSize="small" />, danger: true, onClick: open("delete") },
    );
    return items;
  };

  const spec = pending ? CONFIRMS[pending.kind](pending.user) : null;
  const confirm = async (reason) => {
    const [method, url, body] = spec.request(reason);
    const result = await action.run(method, url, body);
    if (result) {
      const kind = pending.kind;
      setPending(null);
      onChanged?.(kind, pending.user);
    }
  };

  const dialog = (
    <AdminConfirmDialog
      open={Boolean(spec)}
      title={spec?.title}
      description={spec?.description}
      confirmLabel={spec?.label}
      variant={spec?.variant}
      reasonLabel={spec?.reasonLabel}
      typedWord={spec?.typedWord}
      busy={action.busy}
      error={action.error}
      onConfirm={confirm}
      onCancel={() => setPending(null)}
    />
  );

  return { itemsFor, dialog };
}

