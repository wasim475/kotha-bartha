import { Search } from "@mui/icons-material";

import { colorFor } from "../../../../utility/helpers";

export default function SearchBox({
  search,
  results,
  onSearchChange,
  onSelect,
}) {
  return (
    <div className="search-box search-wrap">
      <Search fontSize="small" />

      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search people"
      />

      {results.length > 0 && (
        <div className="search-results">
          {results.map((person) => (
            <button key={person.id} onClick={() => onSelect(person)}>
              <span className={`avatar avatar-${colorFor(person.id)}`}>
                {person.initials}
              </span>
              <strong>{person.fullName}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
