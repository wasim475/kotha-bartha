import {
  ChatBubble,
  Home,
  Logout,
  NotificationsNone,
  PeopleAlt,
  PersonAddAlt,
  Settings,
} from "@mui/icons-material";

import React, {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";

import { api } from "../../utility/api";

import { useRealtime } from "../../utility/helpers";


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
  {
    label: "Profile",
    path: "/app/profile/me",
    icon: PersonAddAlt,
    key: "profile",
  },
];


function NavItem({
  item,
  active,
  badge,
  onClick,
}) {
  const Icon = item.icon;

  return (
    <button
      className={`nav-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <span className="nav-icon">
        <Icon fontSize="small" />

        {badge > 0 && (
          <b className="nav-badge">
            {badge > 99 ? "99+" : badge}
          </b>
        )}
      </span>

      <span>{item.label}</span>
    </button>
  );
}


const Navbar = ({ onLogout }) => {
  const { theme, setTheme } =
    useContext(Utility);

  const location = useLocation();

  const navigate = useNavigate();


  // ============================================================
  // UNREAD COUNTS
  // ============================================================

  const [counts, setCounts] = useState({
    feed: 0,
    friends: 0,
    messages: 0,
    notifications: 0,
  });


  // ============================================================
  // LOAD UNREAD COUNTS
  // ============================================================

  const loadCounts = async () => {
    try {
      const { data } = await api.get(
        "/notifications/unread-counts"
      );

      setCounts({
        feed: Number(data.data?.feed || 0),

        friends: Number(
          data.data?.friends || 0
        ),

        messages: Number(
          data.data?.messages || 0
        ),

        notifications: Number(
          data.data?.notifications || 0
        ),
      });
    } catch (error) {
      console.error(
        "Unable to load unread counts:",
        error
      );
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadCounts();
  }, []);


  // ============================================================
  // NEW MESSAGE
  // ============================================================

  useRealtime("message:new", () => {
    setCounts((current) => ({
      ...current,
      messages: current.messages + 1,
    }));
  });


  // ============================================================
  // NEW NOTIFICATION
  // ============================================================

  useRealtime("notification:new", () => {
    setCounts((current) => ({
      ...current,
      notifications:
        current.notifications + 1,
    }));
  });


  // ============================================================
  // NEW FEED / POST
  // ============================================================

  useRealtime("post:new", () => {
    setCounts((current) => ({
      ...current,
      feed: current.feed + 1,
    }));
  });


  // ============================================================
  // FRIEND REQUEST
  // ============================================================

  useRealtime("friend:new", () => {
    setCounts((current) => ({
      ...current,
      friends: current.friends + 1,
    }));
  });


  // ============================================================
  // REALTIME CONNECTED
  // ============================================================

  useRealtime(
    "realtime:connected",
    () => {
      loadCounts();
    }
  );


  // ============================================================
  // HANDLE NAVIGATION
  // ============================================================

  const handleNavigate = (item) => {
    /*
     * যেই section-এ click করা হয়েছে
     * তার unread count 0 করে দিচ্ছি।
     */

    if (item.key === "messages") {
      setCounts((current) => ({
        ...current,
        messages: 0,
      }));
    }

    if (item.key === "notifications") {
      setCounts((current) => ({
        ...current,
        notifications: 0,
      }));
    }

    if (item.key === "feed") {
      setCounts((current) => ({
        ...current,
        feed: 0,
      }));
    }

    if (item.key === "friends") {
      setCounts((current) => ({
        ...current,
        friends: 0,
      }));
    }

    navigate(item.path);
  };


  // ============================================================
  // ACTIVE ITEM
  // ============================================================

  const active =
    navItems.find((item) =>
      location.pathname.startsWith(
        item.path
      )
    ) || navItems[0];


  // ============================================================
  // BADGE VALUE
  // ============================================================

  const getBadge = (item) => {
    if (item.key === "feed") {
      return counts.feed;
    }

    if (item.key === "friends") {
      return counts.friends;
    }

    if (item.key === "messages") {
      return counts.messages;
    }

    if (item.key === "notifications") {
      return counts.notifications;
    }

    return 0;
  };


  return (
    <>
      {/* ========================================================
          DESKTOP NAVBAR
      ======================================================== */}

      <aside className="desktop-nav">
        <p className="nav-label">
          Your space
        </p>

        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={
              active.path === item.path
            }
            badge={getBadge(item)}
            onClick={() =>
              handleNavigate(item)
            }
          />
        ))}


        {/* Bottom */}

        <div className="nav-bottom">

          {/* Theme */}

          <button
            className="nav-item"
            onClick={() =>
              setTheme(
                theme === "light"
                  ? "dark"
                  : "light"
              )
            }
          >
            <Settings fontSize="small" />

            <span>
              Preferences
            </span>
          </button>


          {/* Logout */}

          <button
            className="nav-item"
            onClick={onLogout}
          >
            <Logout fontSize="small" />

            <span>
              Log out
            </span>
          </button>

        </div>
      </aside>


      {/* ========================================================
          MOBILE BOTTOM NAVBAR
      ======================================================== */}

      <nav className="bottom-nav">

        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={
              active.path === item.path
            }
            badge={getBadge(item)}
            onClick={() =>
              handleNavigate(item)
            }
          />
        ))}

      </nav>
    </>
  );
};


export default Navbar;