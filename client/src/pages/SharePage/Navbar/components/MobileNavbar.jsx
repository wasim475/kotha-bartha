
import NavItem from "./NavItem";


export default function MobileNavbar({
  theme,
  navItems,
  active,
  getBadge,
  onNavigate,
 
}) {
  return (
    <nav
      className={`bottom-nav ${theme === "dark" ? "nav-dark" : "nav-light"}`}
    >
      {navItems.map((item) => (
        <NavItem
          key={item.path}
          item={item}
          active={active?.path === item.path}
          badge={getBadge(item)}
          onClick={() => onNavigate(item)}
        />
      ))}
    </nav>
  );
}
