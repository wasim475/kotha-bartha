const styles = {
  admin: "bg-accent/15 text-accent",
  moderator: "bg-soft text-accent",
  user: "bg-soft text-muted",
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  banned: "bg-danger-soft text-danger",
  muted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  deleted: "bg-soft text-muted",
  visible: "bg-green-500/15 text-green-600 dark:text-green-400",
  hidden: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  reviewing: "bg-accent/15 text-accent",
  resolved: "bg-green-500/15 text-green-600 dark:text-green-400",
  dismissed: "bg-soft text-muted",
};

export function Pill({ tone, children }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${styles[tone] || styles.user}`}>{children}</span>;
}

const label = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/** A person's role plus their account state (Banned / Muted) as small badges. */
export default function AdminUserStatus({ user, showRole = true }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {showRole && <Pill tone={user.role || "user"}>{label(user.role || "user")}</Pill>}
      {user.accountStatus === "banned" ? <Pill tone="banned">Banned</Pill> : user.accountStatus === "deleted" ? <Pill tone="deleted">Deleted</Pill> : <Pill tone="active">Active</Pill>}
      {user.isMuted && <Pill tone="muted">Muted</Pill>}
    </span>
  );
}
