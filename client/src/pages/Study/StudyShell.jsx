import { useContext } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";

import StudyNavbar from "./StudyNavbar";
import StudyPlaceholder from "./StudyPlaceholder";
import StudyTopbar from "./StudyTopbar";
import { studyNavItems } from "./studyNavItems";

const descriptions = {
  blogs: "Study notes, guides and articles from the কথা-বার্তা community.",
  quiz: "Test what you know with quick, bite-sized quizzes.",
  "class-study": "Class-wise study material and structured resources.",
  games: "Learn while you play — study games are on the way.",
  "study-ai": "Your AI study companion for questions and explanations.",
  leaderboard: "See how you rank among fellow learners.",
};

export default function StudyShell() {
  const navigate = useNavigate();
  const { theme, setTheme } = useContext(Utility);

  return (
    <div className="app-shell study-shell">
      <StudyTopbar
        theme={theme}
        setTheme={setTheme}
        onBack={() => navigate("/app/feed")}
      />

      <div className="app-body">
        <StudyNavbar />

        <main className="page-content">
          <Routes>
            {studyNavItems.map((item) => (
              <Route
                key={item.path}
                path={item.key}
                element={
                  <StudyPlaceholder
                    icon={item.icon}
                    label={item.label}
                    description={descriptions[item.key]}
                  />
                }
              />
            ))}
            <Route path="*" element={<Navigate to="blogs" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
