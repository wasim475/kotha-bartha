export default function NavItem({ item, active, badge, onClick }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="nav-icon">
        <Icon fontSize="small" />

        {badge > 0 && <b className="nav-badge">{badge > 99 ? "99+" : badge}</b>}
      </span>

      <span>{item.label}</span>
    </button>
  );
}
