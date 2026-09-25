import { NavLink, useOutletContext } from "react-router-dom";

import AdminPage from "../../components/admin/AdminPage";
import { useAdmin } from "../../components/admin/AdminContext";
import { cx } from "../../utility/cx";
import QuizAdmin from "../Study/quiz/QuizAdmin";

/** Switches between Quiz and Game content inside the "Quiz & Games" section. */
export function ContentSwitch() {
  const { sections } = useAdmin();
  const tabs = [
    ["/admin/quiz", "Quiz", "quiz"],
    ["/admin/games", "English Games", "games"],
  ].filter(([, , section]) => sections.includes(section));
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Content type">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} role="tab" className={({ isActive }) => cx("inline-flex min-h-10 items-center rounded-full border px-4 text-xs font-semibold", isActive ? "border-accent bg-accent/12 text-accent" : "border-line bg-panel text-muted hover:text-ink")}>
          {label}
        </NavLink>
      ))}
    </div>
  );
}

/**
 * /admin/quiz — Quiz authoring (categories, classes, subjects, chapters, questions,
 * bulk sets) is the EXISTING screen and API, reused as is; every change is written
 * to the audit log. The original Quiz Admin inside the Study section keeps working.
 */
export default function AdminQuiz() {
  const { user } = useOutletContext();
  return (
    <AdminPage title="Quiz & Games" subtitle="Author Quiz content. Changes here use the same tools as the Study section.">
      <ContentSwitch />
      <div className="games-scope min-w-0">
        <QuizAdmin user={user} />
      </div>
    </AdminPage>
  );
}
