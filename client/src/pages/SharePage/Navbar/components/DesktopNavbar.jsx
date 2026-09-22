import NavItem from "./NavItem";
import Avatar from "../../../../components/ui/Avatar";


export default function DesktopNavbar({
  theme,
  navItems,
  active,
  getBadge,
  onNavigate,
  user,
  onNavigateProfile,
}) {
  return (
    <aside
      className={`desktop-nav ${theme === "dark" ? "nav-dark" : "nav-light"}`}
    >
      {user && (
        <button
          type="button"
          className="nav-profile-card"
          onClick={onNavigateProfile}
        >
          <Avatar person={user} size="md" />
          <span className="nav-profile-meta">
            <span className="nav-profile-name">{user.fullName}</span>
            <span className="nav-profile-hint">View your profile</span>
          </span>
        </button>
      )}

      <p className="nav-label">Your space</p>

      {navItems.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={active?.path === item.path}
          badge={getBadge(item)}
          onClick={() => onNavigate(item)}
        />
      ))}
    </aside>
  );
}
