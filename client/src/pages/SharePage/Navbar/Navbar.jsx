import {
  ChatBubble,
  Home,
  NotificationsNone,
  PeopleAlt,
} from "@mui/icons-material";
import { useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Utility } from "../../../provider/UtilityProvider";

import DesktopNavbar from "./components/DesktopNavbar";
import MobileNavbar from "./components/MobileNavbar";
import useUnreadCounts from "./hooks/useUnreadCounts";

const navItems = [
  {
    label: "Feed",
    path: "/app/feed",
    icon: Home,
    key: "feed",
  },
  {
    label: "Friends",
    path: "/app/friends",
    icon: PeopleAlt,
    key: "friends",
  },
  {
    label: "Messages",
    path: "/app/messages",
    icon: ChatBubble,
    key: "messages",
  },
  {
    label: "Alerts",
    path: "/app/notifications",
    icon: NotificationsNone,
    key: "notifications",
  },
];

export default function Navbar({ onLogout }) {
  const { theme, setTheme } = useContext(Utility);
  const location = useLocation();
  const navigate = useNavigate();
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { counts, clearCount } = useUnreadCounts();

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

  const handleNavigate = (item) => {
    clearCount(item.key);
    navigate(item.path);
  };

  const handleProfile = () => {
    setProfileOpen(false);
    navigate("/app/profile/me");
  };

  const handleLogout = () => {
    setProfileOpen(false);
    onLogout();
  };

  const active =
    navItems.find((item) => location.pathname.startsWith(item.path)) || null;
  const profileActive = location.pathname.startsWith("/app/profile");
  const getBadge = (item) => counts[item.key] || 0;
  const toggleProfile = () => setProfileOpen((current) => !current);

  const sharedProps = {
    navItems,
    active,
    getBadge,
    onNavigate: handleNavigate,
    profileActive,
    profileOpen,
    onToggleProfile: toggleProfile,
    onProfile: handleProfile,
    onLogout: handleLogout,
  };

  return (
    <>
      <DesktopNavbar
        {...sharedProps}
        theme={theme}
        setTheme={setTheme}
        profileRef={desktopProfileRef}
      />
      <MobileNavbar
        {...sharedProps}
        theme={theme}
        profileRef={mobileProfileRef}
      />
    </>
  );
}
