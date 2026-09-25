import { ArrowBack, DarkMode, Menu as MenuIcon, WbSunny } from "@mui/icons-material";
import { useContext } from "react";
import { Link } from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";
import IconButton from "../ui/IconButton";
import { Pill } from "./AdminUserStatus";

/** The top bar: menu button (phones), brand, theme toggle, way back to the app. */
export default function AdminHeader({ user, onOpenMenu }) {
  const { theme, setTheme } = useContext(Utility);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-panel/95 px-3 backdrop-blur sm:px-5">
      <IconButton label="Open admin menu" icon={<MenuIcon />} onClick={onOpenMenu} className="lg:hidden" data-testid="admin-menu-button" />
      <Link to="/admin" className="flex min-w-0 items-center gap-2 font-display text-base font-semibold text-ink">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white" aria-hidden="true">
          K
        </span>
        <span className="truncate">Admin Panel</span>
      </Link>
      <span className="hidden sm:inline-flex">
        <Pill tone={user.role}>{user.role === "admin" ? "Admin" : "Moderator"}</Pill>
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Toggle theme" icon={theme === "light" ? <DarkMode fontSize="small" /> : <WbSunny fontSize="small" />} onClick={() => setTheme(theme === "light" ? "dark" : "light")} />
        <Link to="/app/feed" className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-soft hover:text-ink">
          <ArrowBack style={{ fontSize: 16 }} />
          <span className="hidden min-[400px]:inline">Back to app</span>
        </Link>
      </div>
    </header>
  );
}
