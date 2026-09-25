import { ArticleRounded, EmojiEventsRounded, FlagRounded, GroupAddRounded, PeopleAltRounded, TodayRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";

import AdminPage from "../../components/admin/AdminPage";
import AdminStatCard from "../../components/admin/AdminStatCard";
import Card from "../../components/ui/Card";
import useAdminQuery from "../../hooks/admin/useAdminQuery";

const CARDS = [
  { key: "totalUsers", label: "Total Users", icon: <PeopleAltRounded fontSize="small" /> },
  { key: "activeToday", label: "Active Users Today", icon: <TodayRounded fontSize="small" /> },
  { key: "newToday", label: "New Users Today", icon: <GroupAddRounded fontSize="small" /> },
  { key: "totalPosts", label: "Total Posts", icon: <ArticleRounded fontSize="small" /> },
  { key: "pendingReports", label: "Pending Reports", icon: <FlagRounded fontSize="small" />, link: "/admin/reports" },
  { key: "participantsToday", label: "Today's Quiz/Game Participants", icon: <EmojiEventsRounded fontSize="small" /> },
];

/** /admin — headline numbers, all computed by the server. */
export default function AdminDashboard() {
  const dashboard = useAdminQuery("/admin/dashboard");

  return (
    <AdminPage title="Dashboard" subtitle="How the community is doing right now.">
      {dashboard.error && (
        <Card className="text-sm text-danger" role="alert">
          {dashboard.error}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => {
          const stat = <AdminStatCard label={card.label} icon={card.icon} loading={dashboard.loading} value={dashboard.data?.[card.key]} tone={card.key === "pendingReports" && dashboard.data?.pendingReports > 0 ? "text-accent" : undefined} />;
          return card.link ? (
            <Link key={card.key} to={card.link} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {stat}
            </Link>
          ) : (
            <div key={card.key}>{stat}</div>
          );
        })}
      </div>
    </AdminPage>
  );
}
