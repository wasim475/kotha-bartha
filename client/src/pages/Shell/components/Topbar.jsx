import SearchBox from "./SearchBox";
import UserActions from "./UserActions";

export default function Topbar({
  theme,
  setTheme,
  user,
  search,
  results,
  onSearchChange,
  onSelectSearchResult,
  onProfileDefault,
  onBrandClick,
  onStudyClick,
   profileOpen,
  onToggleProfile,
  onProfile,
  onLogout,
  desktopProfileRef,
}) {
  return (
    <header className="topbar">
      <button className="wordmark compact" onClick={onBrandClick}>
        <span className="brand-mark">K</span>
        <span>
          Kotha<span>-Barta</span>
        </span>
      </button>

      <SearchBox
        search={search}
        results={results}
        onSearchChange={onSearchChange}
        onSelect={onSelectSearchResult}
      />

      <UserActions
        theme={theme}
        setTheme={setTheme}
        user={user}
        onProfileDefault={onProfileDefault}
        onStudyClick={onStudyClick}
        profileOpen={profileOpen}
        onToggleProfile={onToggleProfile}
        onProfile={onProfile}
        onLogout={onLogout}
        profileRef={desktopProfileRef}
      />
    </header>
  );
}
