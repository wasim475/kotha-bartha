import { Person } from "@mui/icons-material";
import NavItem from "./NavItem";
import ProfileMenu from "./ProfileMenu";

export default function MobileNavbar({
  theme,
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
    <nav
      className={`bottom-nav ${theme === "dark" ? "nav-dark" : "nav-light"}`}
    >
      {navItems.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={active?.path === item.path}
          badge={getBadge(item)}
          onClick={() => onNavigate(item)}
        />
      ))}

      <div className="mobile-profile-wrapper" ref={profileRef}>
        <button
          type="button"
          className={`nav-item ${profileActive ? "active" : ""}`}
          onClick={onToggleProfile}
        >
          <span className="nav-icon">
            <Person fontSize="small" />
          </span>

          <span>More</span>
        </button>

        {profileOpen && (
          <ProfileMenu onProfile={onProfile} onLogout={onLogout} />
        )}
      </div>
    </nav>
  );
}
