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
   profileOpen,
  onToggleProfile,
  onProfile,
  onLogout,
  desktopProfileRef,
  mobileProfileRef,
}) {
  return (
    <header className="topbar">
      <button className="wordmark compact" onClick={onBrandClick}>
        <span className="brand-mark">ক</span>
        <span>
          কথা<span>-বার্তা</span>
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
        profileOpen={profileOpen}
        onToggleProfile={onToggleProfile}
        onProfile={onProfile}
        onLogout={onLogout}
        profileRef={desktopProfileRef}
      />
    </header>
  );
}
