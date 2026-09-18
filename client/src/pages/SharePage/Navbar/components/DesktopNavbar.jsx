import { Person } from "@mui/icons-material";
import NavItem from "./NavItem";


export default function DesktopNavbar({
  theme,
  navItems,
  active,
  getBadge,
  onNavigate,
  
  
}) {
  return (
    <aside
      className={`desktop-nav ${theme === "dark" ? "nav-dark" : "nav-light"}`}
    >
      <p className="nav-label">Your space</p>

      {navItems.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={active?.path === item.path}
          badge={getBadge(item)}
          onClick={() => onNavigate(item)}
        />
      ))}
    </aside>
  );
}
