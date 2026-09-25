import {
  BarChartRounded,
  DashboardRounded,
  FlagRounded,
  HistoryRounded,
  MailRounded,
  PeopleAltRounded,
  QuizRounded,
  SettingsRounded,
  ArticleRounded,
} from "@mui/icons-material";
import { NavLink } from "react-router-dom";

import { cx } from "../../utility/cx";
import { useAdmin } from "./AdminContext";

// One entry per sidebar item. `section` is what the server's role table grants;
// `match` lets one item stay highlighted across several routes.
const ITEMS = [
  { label: "Dashboard", to: "/admin", section: "dashboard", icon: DashboardRounded, end: true },
  { label: "Users", to: "/admin/users", section: "users", icon: PeopleAltRounded },
  { label: "Posts", to: "/admin/posts", section: "posts", icon: ArticleRounded },
  { label: "Reports", to: "/admin/reports", section: "reports", icon: FlagRounded, badge: "reports" },
  { label: "Messages", to: "/admin/messages", section: "messages", icon: MailRounded, badge: "support" },
  { label: "Quiz & Games", to: "/admin/quiz", section: "quiz", icon: QuizRounded, also: ["/admin/games"] },
  { label: "Analytics", to: "/admin/analytics", section: "analytics", icon: BarChartRounded },
  { label: "Moderation Logs", to: "/admin/moderation-logs", section: "logs", icon: HistoryRounded },
  { label: "Settings", to: "/admin/settings", section: "settings", icon: SettingsRounded },
];

/** The navigation list (used in the desktop sidebar and inside the mobile drawer). */
export default function AdminSidebar({ onNavigate }) {
  const { sections, counts } = useAdmin();
  const visible = ITEMS.filter((item) => sections.includes(item.section) || (item.section === "quiz" && sections.includes("games")));

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {visible.map((item) => {
        const Icon = item.icon;
        const badge = item.badge ? counts[item.badge] : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => {
              const active = isActive || (item.also || []).some((path) => window.location.pathname.startsWith(path));
              return cx(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                active ? "bg-accent/12 text-accent" : "text-muted hover:bg-soft hover:text-ink",
              );
            }}
          >
            <Icon fontSize="small" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className="min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold text-white" aria-label={`${badge} waiting`}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
