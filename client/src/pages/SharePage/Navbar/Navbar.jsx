import {
  ChatBubble,
  Home,
  NotificationsNone,
  PeopleAlt,
} from "@mui/icons-material";
import { useContext, useRef } from "react";
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

export default function Navbar({ user }) {
  const { theme, setTheme } = useContext(Utility);
  const location = useLocation();
  const navigate = useNavigate();
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const { counts, clearCount } = useUnreadCounts();

  

  const handleNavigate = (item) => {
    clearCount(item.key);
    navigate(item.path);
  };

 
  const active =
    navItems.find((item) => location.pathname.startsWith(item.path)) || null;
  const profileActive = location.pathname.startsWith("/app/profile");
  const getBadge = (item) => counts[item.key] || 0;
  

  const sharedProps = {
    navItems,
    active,
    getBadge,
    onNavigate: handleNavigate,
    profileActive,
  };

  return (
    <>
      <DesktopNavbar
        {...sharedProps}
        theme={theme}
        setTheme={setTheme}
        profileRef={desktopProfileRef}
        user={user}
        onNavigateProfile={() => navigate("/app/profile/me")}
      />
      <MobileNavbar
        {...sharedProps}
        theme={theme}
        profileRef={mobileProfileRef}
      />
    </>
  );
}
