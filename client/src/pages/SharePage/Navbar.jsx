import {
  ChatBubble,
  Home,
  Logout,
  NotificationsNone,
  PeopleAlt,
  Person,
  Settings,
} from "@mui/icons-material";

import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";
import { api } from "../../utility/api";
import { useRealtime } from "../../utility/helpers";


/* ============================================================
   NAV ITEMS
   ============================================================ */

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


/* ============================================================
   NAV ITEM
   ============================================================ */

function NavItem({
  item,
  active,
  badge,
  onClick,
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
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


/* ============================================================
   PROFILE POPUP
   ============================================================ */

function ProfilePopup({
  onProfile,
  onLogout,
}) {
  return (
    <div className="profile-popup">
      <button
        type="button"
        className="profile-popup-item"
        onClick={onProfile}
      >
        <Person fontSize="small" />

        <span>Profile</span>
      </button>

      <button
        type="button"
        className="profile-popup-item logout-item"
        onClick={onLogout}
      >
        <Logout fontSize="small" />

        <span>Log out</span>
      </button>
    </div>
  );
}


/* ============================================================
   NAVBAR
   ============================================================ */

const Navbar = ({ onLogout }) => {
  const { theme, setTheme } =
    useContext(Utility);

  const location = useLocation();
  const navigate = useNavigate();

  const profileRef = useRef(null);

  const [profileOpen, setProfileOpen] =
    useState(false);

  /* ============================================================
     UNREAD COUNTS
     ============================================================ */

  const [counts, setCounts] = useState({
    feed: 0,
    friends: 0,
    messages: 0,
    notifications: 0,
  });


  /* ============================================================
     LOAD UNREAD COUNTS
     ============================================================ */

  const loadCounts = async () => {
    try {
      const { data } = await api.get(
        "/notifications/unread-counts",
      );

      setCounts({
        feed: Number(
          data.data?.feed || 0,
        ),

        friends: Number(
          data.data?.friends || 0,
        ),

        messages: Number(
          data.data?.messages || 0,
        ),

        notifications: Number(
          data.data?.notifications || 0,
        ),
      });
    } catch (error) {
      console.error(
        "Unable to load unread counts:",
        error,
      );
    }
  };


  /* ============================================================
     INITIAL LOAD
     ============================================================ */

  useEffect(() => {
    loadCounts();
  }, []);


  /* ============================================================
     NEW MESSAGE
     ============================================================ */

  useRealtime("message:new", loadCounts);


  /* ============================================================
     NEW NOTIFICATION
     ============================================================ */

  useRealtime("notification:new", () => {
    setCounts((current) => ({
      ...current,
      notifications:
        current.notifications + 1,
    }));
  });


  /* ============================================================
     NEW FEED / POST
     ============================================================ */

  useRealtime("post:new", () => {
    setCounts((current) => ({
      ...current,
      feed: current.feed + 1,
    }));
  });


  /* ============================================================
     FRIEND REQUEST
     ============================================================ */

  useRealtime("friend:new", () => {
    setCounts((current) => ({
      ...current,
      friends:
        current.friends + 1,
    }));
  });


  /* ============================================================
     REALTIME CONNECTED
     ============================================================ */

  useRealtime(
    "realtime:connected",
    () => {
      loadCounts();
    },
  );


  /* ============================================================
     CLOSE PROFILE POPUP WHEN CLICKING OUTSIDE
     ============================================================ */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target,
        )
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);


  /* ============================================================
     HANDLE NAVIGATION
     ============================================================ */

  const handleNavigate = (item) => {
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


  /* ============================================================
     PROFILE
     ============================================================ */

  const handleProfile = () => {
    setProfileOpen(false);

    navigate("/app/profile/me");
  };


  /* ============================================================
     LOGOUT
     ============================================================ */

  const handleLogout = () => {
    setProfileOpen(false);

    onLogout();
  };


  /* ============================================================
     ACTIVE ITEM
     ============================================================ */

  const active =
    navItems.find((item) =>
      location.pathname.startsWith(
        item.path,
      ),
    ) || null;


  /* ============================================================
     BADGE VALUE
     ============================================================ */

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

    if (
      item.key === "notifications"
    ) {
      return counts.notifications;
    }

    return 0;
  };


  /* ============================================================
     PROFILE ACTIVE
     ============================================================ */

  const profileActive =
    location.pathname.startsWith(
      "/app/profile",
    );


  return (
    <>
      {/* ========================================================
          DESKTOP NAVBAR
          ======================================================== */}

      <aside
        className={`desktop-nav ${
          theme === "dark"
            ? "nav-dark"
            : "nav-light"
        }`}
      >
        <p className="nav-label">
          Your space
        </p>


        {/* Main Navigation */}

        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={
              active?.path === item.path
            }
            badge={getBadge(item)}
            onClick={() =>
              handleNavigate(item)
            }
          />
        ))}


        {/* Profile */}

        <div
          className="profile-nav-wrapper"
          ref={profileRef}
        >
          <button
            type="button"
            className={`nav-item ${
              profileActive
                ? "active"
                : ""
            }`}
            onClick={() =>
              setProfileOpen(
                (current) => !current,
              )
            }
          >
            <span className="nav-icon">
              <Person fontSize="small" />
            </span>

            <span>Profile</span>
          </button>


          {profileOpen && (
            <ProfilePopup
              onProfile={handleProfile}
              onLogout={handleLogout}
            />
          )}
        </div>


        {/* Bottom */}

        <div className="nav-bottom">

          {/* Theme */}

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              setTheme(
                theme === "light"
                  ? "dark"
                  : "light",
              )
            }
          >
            <Settings fontSize="small" />

            <span>
              {theme === "light"
                ? "Night mode"
                : "Light mode"}
            </span>
          </button>

        </div>
      </aside>


      {/* ========================================================
          MOBILE BOTTOM NAVBAR
          ======================================================== */}

      <nav
        className={`bottom-nav ${
          theme === "dark"
            ? "nav-dark"
            : "nav-light"
        }`}
      >

        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={
              active?.path === item.path
            }
            badge={getBadge(item)}
            onClick={() =>
              handleNavigate(item)
            }
          />
        ))}


        {/* Mobile Profile */}

        <div
          className="mobile-profile-wrapper"
          ref={
            profileOpen
              ? profileRef
              : null
          }
        >
          <button
            type="button"
            className={`nav-item ${
              profileActive
                ? "active"
                : ""
            }`}
            onClick={() =>
              setProfileOpen(
                (current) => !current,
              )
            }
          >
            <span className="nav-icon">
              <Person fontSize="small" />
            </span>

            <span>Profile</span>
          </button>


          {profileOpen && (
            <ProfilePopup
              onProfile={handleProfile}
              onLogout={handleLogout}
            />
          )}
        </div>

      </nav>
    </>
  );
};

export default Navbar;