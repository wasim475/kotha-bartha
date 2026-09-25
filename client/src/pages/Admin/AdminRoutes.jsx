import { Navigate, Route, Routes } from "react-router-dom";

import AccessDenied from "../../components/admin/AccessDenied";
import { useAdmin } from "../../components/admin/AdminContext";
import AdminShell from "../../components/admin/AdminShell";
import AdminAnalytics from "./AdminAnalytics";
import AdminDashboard from "./AdminDashboard";
import AdminGames from "./AdminGames";
import AdminMessages from "./AdminMessages";
import AdminModerationLogs from "./AdminModerationLogs";
import AdminPostDetail from "./AdminPostDetail";
import AdminPosts from "./AdminPosts";
import AdminQuiz from "./AdminQuiz";
import AdminReportDetail from "./AdminReportDetail";
import AdminReports from "./AdminReports";
import AdminSettings from "./AdminSettings";
import AdminUserDetails from "./AdminUserDetails";
import AdminUsers from "./AdminUsers";

// A page that renders only if the SERVER granted this section to the signed-in
// staff member (GET /admin/me), otherwise a plain access-denied — never the page.
function Section({ name, children }) {
  const { sections } = useAdmin();
  return sections.includes(name) ? children : <AccessDenied message="Your role doesn't include this section." />;
}

// The dashboard is admin-only; a moderator lands on the content tools instead.
function Home() {
  const { sections } = useAdmin();
  return sections.includes("dashboard") ? <AdminDashboard /> : <Navigate to="/admin/quiz" replace />;
}

/**
 * Everything under /admin. Anyone who is not an admin or moderator gets "access
 * denied" before a single admin request is made (and the server would refuse those
 * requests anyway).
 */
export default function AdminRoutes({ user }) {
  if (user.role !== "admin" && user.role !== "moderator") return <AccessDenied />;
  return (
    <Routes>
      <Route element={<AdminShell user={user} />}>
        <Route index element={<Home />} />
        <Route path="users" element={<Section name="users"><AdminUsers /></Section>} />
        <Route path="users/:userId" element={<Section name="users"><AdminUserDetails /></Section>} />
        <Route path="posts" element={<Section name="posts"><AdminPosts /></Section>} />
        <Route path="posts/:postId" element={<Section name="posts"><AdminPostDetail /></Section>} />
        <Route path="reports" element={<Section name="reports"><AdminReports /></Section>} />
        <Route path="reports/:reportId" element={<Section name="reports"><AdminReportDetail /></Section>} />
        <Route path="messages" element={<Section name="messages"><AdminMessages /></Section>} />
        <Route path="quiz" element={<Section name="quiz"><AdminQuiz /></Section>} />
        <Route path="games" element={<Section name="games"><AdminGames /></Section>} />
        <Route path="analytics" element={<Section name="analytics"><AdminAnalytics /></Section>} />
        <Route path="moderation-logs" element={<Section name="logs"><AdminModerationLogs /></Section>} />
        <Route path="settings" element={<Section name="settings"><AdminSettings /></Section>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
