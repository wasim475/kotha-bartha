import { useContext, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";
import { cx } from "../../utility/cx";

import Navbar from "../../pages/SharePage/Navbar/Navbar";
import Feed from "../../pages/feed/Feed";
import SinglePost from "../../pages/feed/SinglePost";
import Friends from "../../pages/friends/Friends";
import Message from "../../pages/message/Message";
import Notifications from "../../pages/notifications/Notifications";
import Profile from "../../pages/profile/Profile";
import Topbar from "./components/Topbar";
import useSocket from "./hooks/useSocket";
import useTabNotifications from "./hooks/useTabNotifications";
import useUserSearch from "./hooks/useUserSearch";
import PrivacyPolicy from '../privacyPolicy/PrivacyPolicy';

export default function Shell({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMessagesRoute = location.pathname.startsWith("/app/messages");
  const { theme, setTheme } = useContext(Utility);
  const { search, results, updateSearch, clearSearch } = useUserSearch();

  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useSocket(user.id);
  useTabNotifications();

  const selectSearchResult = (person) => {
    navigate(`/app/profile/${person.id}`);
    clearSearch();
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const insideDesktopProfile = desktopProfileRef.current?.contains(
        event.target,
      );
      const insideMobileProfile = mobileProfileRef.current?.contains(
        event.target,
      );

      if (!insideDesktopProfile && !insideMobileProfile) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleProfile = () => {
    setProfileOpen(false);
    navigate("/app/profile/me");
  };

  const handleLogout = () => {
    setProfileOpen(false);
    onLogout();
  };

  const toggleProfile = () => setProfileOpen((current) => !current);

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
        onProfileDefault={() => navigate("/app/profile/me")}
        onBrandClick={() => navigate("/app/feed")}
        profileOpen={profileOpen}
        onToggleProfile={toggleProfile}
        onProfile={handleProfile}
        onLogout={handleLogout}
        desktopProfileRef={desktopProfileRef}
        mobileProfileRef={mobileProfileRef}
      />

      <div className={cx("app-body", isMessagesRoute && "app-body--full")}>
        <Navbar onLogout={onLogout} />

        <main className="page-content">
          <Routes>
            <Route path="feed" element={<Feed user={user} />} />
            <Route path="post/:postId" element={<SinglePost user={user} />} />
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
