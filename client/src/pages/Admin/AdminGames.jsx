import AdminPage from "../../components/admin/AdminPage";
import EnglishQuestionAdmin from "../Study/games/admin/EnglishQuestionAdmin";
import { ContentSwitch } from "./AdminQuiz";

/**
 * /admin/games — the English Word / Conversion question bank (add, edit, enable or
 * disable, search, filter by game). It is the EXISTING screen and API, reused as
 * is; the answer keys stay on the server and are only ever sent to staff.
 */
export default function AdminGames() {
  return (
    <AdminPage title="Quiz & Games" subtitle="Manage the educational game question bank.">
      <ContentSwitch />
      <div className="games-scope min-w-0">
        <EnglishQuestionAdmin />
      </div>
    </AdminPage>
  );
}
