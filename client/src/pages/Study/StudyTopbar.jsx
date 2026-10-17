import { ArrowBack, DarkMode, WbSunny } from "@mui/icons-material";

export default function StudyTopbar({ theme, setTheme, onBack }) {
  return (
    <header className="study-topbar">
      <div className="study-brand">
        <span className="study-brand-mark">স</span>
        <span className="study-wordmark">
          কথা<span>-স্টাডি</span>
        </span>
      </div>

      <div className="study-topbar-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <DarkMode /> : <WbSunny />}
        </button>

        <button type="button" className="study-back-button" onClick={onBack}>
          <ArrowBack fontSize="small" />
          <span>Back to কথা-বার্তা</span>
        </button>
      </div>
    </header>
  );
}
