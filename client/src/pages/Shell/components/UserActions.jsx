import { AutoStories, DarkMode, WbSunny } from "@mui/icons-material";
import ProfileMenu from "../../SharePage/Navbar/components/ProfileMenu";

export default function UserActions({
  theme,
  setTheme,
  user,
  profileOpen,
  onToggleProfile,
  onProfile,
  onLogout,
  onStudyClick,
  profileRef,
}) {
  return (
    <div className="top-actions">

      <button
        type="button"
        className="study-pill"
        onClick={onStudyClick}
        aria-label="কথা-স্টাডি"
      >
        <AutoStories fontSize="small" />
        <span className="study-pill-label">কথা-স্টাডি</span>
      </button>

      <button
        type="button"
        className="icon-button"
        onClick={() =>
          setTheme(theme === "light" ? "dark" : "light")
        }
        aria-label="Toggle theme"
      >
        {theme === "light" ? <DarkMode /> : <WbSunny />}
      </button>

      <div className="profile-wrapper" ref={profileRef}>

        {/* Avatar */}
        <button
          type="button"
          className="avatar avatar-coral"
          onClick={onToggleProfile}
        >
          {user.fullName.slice(0, 1).toUpperCase()}
        </button>

        {/* Popup */}
        {profileOpen && (
          <ProfileMenu
            onProfile={onProfile}
            onLogout={onLogout}
          />
        )}

      </div>

    </div>
  );
}