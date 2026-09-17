import { useEffect, useState } from "react";

import { api } from "../../../../utility/api";

export default function useUserSearch() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!search.trim()) return undefined;

    const timer = setTimeout(
      () =>
        api
          .get(`/users/search?q=${encodeURIComponent(search)}`)
          .then(({ data }) => setResults(data.data))
          .catch(() => setResults([])),
      300,
    );

    return () => clearTimeout(timer);
  }, [search]);

  const updateSearch = (value) => {
    setSearch(value);
    if (!value.trim()) setResults([]);
  };

  const clearSearch = () => {
    setSearch("");
    setResults([]);
  };

  return { search, results, updateSearch, clearSearch };
}
