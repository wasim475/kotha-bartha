import { Person } from "@mui/icons-material";
import NavItem from "./NavItem";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";

export default function DesktopNavbar({
  theme,
  setTheme,
  navItems,
  active,
  getBadge,
  onNavigate,
  profileActive,
  profileOpen,
  profileRef,
  onToggleProfile,
  onProfile,
  onLogout,
}) {
  return (
    <aside
      className={`desktop-nav ${theme === "dark" ? "nav-dark" : "nav-light"}`}
    >
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

      <div className="profile-nav-wrapper" ref={profileRef}>
        <button
          type="button"
          className={`nav-item ${profileActive ? "active" : ""}`}
          onClick={onToggleProfile}
        >
          <span className="nav-icon">
            <Person fontSize="small" />
          </span>

          <span>Profile</span>
        </button>

        {profileOpen && (
          <ProfileMenu onProfile={onProfile} onLogout={onLogout} />
        )}
      </div>

      {/* <div className="nav-bottom">
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div> */}
    </aside>
  );
}
