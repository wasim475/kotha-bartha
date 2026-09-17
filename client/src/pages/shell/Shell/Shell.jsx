import { useContext } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { Utility } from "../../../provider/UtilityProvider";

import Navbar from "../../SharePage/Navbar/Navbar";
import Feed from "../../feed/Feed";
import Friends from "../../friends/Friends";
import Message from "../../message/Message";
import Notifications from "../../notifications/Notifications";
import Profile from "../../profile/Profile";

import Topbar from "./components/Topbar";
import useSocket from "./hooks/useSocket";
import useUserSearch from "./hooks/useUserSearch";

export default function Shell({ user, onLogout }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useContext(Utility);
  const { search, results, updateSearch, clearSearch } = useUserSearch();

  useSocket(user.id);

  const selectSearchResult = (person) => {
    navigate(`/app/profile/${person.id}`);
    clearSearch();
  };

  return (
    <div className="app-shell">
      <Topbar
        theme={theme}
        setTheme={setTheme}
        user={user}
        search={search}
        results={results}
        onSearchChange={updateSearch}
        onSelectSearchResult={selectSearchResult}
        onProfile={() => navigate("/app/profile/me")}
        onBrandClick={() => navigate("/app/feed")}
      />

      <div className="app-body">
        <Navbar onLogout={onLogout} />

        <main className="page-content">
          <Routes>
            <Route path="feed" element={<Feed user={user} />} />
            <Route path="friends" element={<Friends />} />
            <Route path="messages" element={<Message user={user} />} />
            <Route
              path="messages/:conversationId"
              element={<Message user={user} />}
            />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile/:id" element={<Profile user={user} />} />
            <Route path="*" element={<Navigate to="feed" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
