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
  onProfile,
  onBrandClick,
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
        onProfile={onProfile}
      />
    </header>
  );
}
