import {
  ChatBubble,
  Home,
  Logout,
  NotificationsNone,
  PeopleAlt,
  PersonAddAlt,
  Settings,
} from "@mui/icons-material";
import React, { useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Utility } from "../../provider/UtilityProvider";

const navItems = [
  { label: "Feed", path: "/app/feed", icon: Home },
  { label: "Friends", path: "/app/friends", icon: PeopleAlt },
  { label: "Messages", path: "/app/messages", icon: ChatBubble },
  { label: "Alerts", path: "/app/notifications", icon: NotificationsNone },
  { label: "Profile", path: "/app/profile/me", icon: PersonAddAlt },
];

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="nav-icon">
        <Icon fontSize="small" />
        {item.badge && <b>{item.badge}</b>}
      </span>
      <span>{item.label}</span>
    </button>
  );
}

const Navbar = ({ onLogout }) => {
  const { theme, setTheme } = useContext(Utility);
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    navItems.find((item) => location.pathname.startsWith(item.path)) ||
    navItems[0];

  return (
    <>
      {/* Desktop Navbar */}
      <aside className="desktop-nav">
        <p className="nav-label">Your space</p>

        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={active.path === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}

        <div className="nav-bottom">
          <button
            className="nav-item"
            onClick={() =>
              setTheme(theme === "light" ? "dark" : "light")
            }
          >
            <Settings fontSize="small" />
            <span>Preferences</span>
          </button>

          <button className="nav-item" onClick={onLogout}>
            <Logout fontSize="small" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navbar */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={active.path === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>
    </>
  );
};

export default Navbar;