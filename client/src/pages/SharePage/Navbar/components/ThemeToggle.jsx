import { Settings } from "@mui/icons-material";

export default function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      type="button"
      className="nav-item"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Settings fontSize="small" />

      <span>{theme === "light" ? "Night mode" : "Light mode"}</span>
    </button>
  );
}
