import { DarkMode, WbSunny } from "@mui/icons-material";

export default function UserActions({ theme, setTheme, user, onProfile }) {
  return (
    <div className="top-actions">
      <button
        className="icon-button"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label="Toggle theme"
      >
        {theme === "light" ? <DarkMode /> : <WbSunny />}
      </button>

      <button className="avatar avatar-coral" onClick={onProfile}>
        {user.fullName.slice(0, 2).toUpperCase()}
      </button>
    </div>
  );
}
