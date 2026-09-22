import { useLocation, useNavigate } from "react-router-dom";

import NavItem from "../SharePage/Navbar/components/NavItem";
import { studyNavItems } from "./studyNavItems";

export default function StudyNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const active =
    studyNavItems.find((item) => location.pathname.startsWith(item.path)) ||
    null;

  const handleNavigate = (item) => navigate(item.path);

  return (
    <>
      <aside className="study-nav desktop-nav">
        <p className="nav-label">কথা-স্টাডি</p>

        {studyNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={active?.path === item.path}
            badge={0}
            onClick={() => handleNavigate(item)}
          />
        ))}
      </aside>

      <nav className="study-nav bottom-nav">
        {studyNavItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={active?.path === item.path}
            badge={0}
            onClick={() => handleNavigate(item)}
          />
        ))}
      </nav>
    </>
  );
}
