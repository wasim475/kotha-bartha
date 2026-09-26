import { useContext } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { Utility } from "../../provider/UtilityProvider";

import StudyNavbar from "./StudyNavbar";
import StudyPlaceholder from "./StudyPlaceholder";
import StudyTopbar from "./StudyTopbar";
import { studyNavItems } from "./studyNavItems";
import useStudySocket from "./hooks/useStudySocket";
import EnglishQuestionAdmin from "./games/admin/EnglishQuestionAdmin";
import GamePlayer from "./games/GamePlayer";
import ChallengeMatch from "./games/challenge/ChallengeMatch";
import TicTacToeGame from "./games/ticTacToe/TicTacToeGame";
import TicTacToeLobby from "./games/ticTacToe/TicTacToeLobby";
import LudoGame from "./games/ludo/LudoGame";
import LudoHistory from "./games/ludo/LudoHistory";
import LudoHome from "./games/ludo/LudoHome";
import LudoLobby from "./games/ludo/LudoLobby";
import LudoLocal from "./games/ludo/LudoLocal";
import GameReview from "./games/GameReview";
import Games from "./games/Games";
import Leaderboard from "./leaderboard/Leaderboard";
import PreviousLeaderboards from "./leaderboard/PreviousLeaderboards";
import QuizAdmin from "./quiz/QuizAdmin";
import QuizFlow from "./quiz/QuizFlow";

const descriptions = {
  blogs: "Study notes, guides and articles from the কথা-বার্তা community.",
  quiz: "Test what you know with quick, bite-sized quizzes.",
  "class-study": "Class-wise study material and structured resources.",
};

export default function StudyShell({ user }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useContext(Utility);
  const canManageQuiz = user?.role === "admin" || user?.role === "moderator";
  useStudySocket(user.id);

  return (
    <div className="app-shell study-shell">
      <StudyTopbar theme={theme} setTheme={setTheme} onBack={() => navigate("/app/feed")} />

      <div className="app-body">
        <StudyNavbar />

        <main className="page-content">
          <Routes>
            {studyNavItems.map((item) => {
              if (item.key === "quiz") {
                return <Route key={item.path} path={item.key} element={<QuizFlow canManageQuiz={canManageQuiz} />} />;
              }
              if (item.key === "leaderboard") {
                return <Route key={item.path} path={item.key} element={<Leaderboard />} />;
              }
              if (item.key === "games") {
                return <Route key={item.path} path={item.key} element={<Games canManage={canManageQuiz} />} />;
              }
              return (
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
              );
            })}
            <Route
              path="quiz-admin"
              element={canManageQuiz ? <QuizAdmin user={user} /> : <Navigate to="quiz" replace />}
            />
            <Route path="leaderboard/history" element={<PreviousLeaderboards />} />
            <Route
              path="games/manage"
              element={canManageQuiz ? <EnglishQuestionAdmin /> : <Navigate to="/study/games" replace />}
            />
            <Route path="games/tic-tac-toe" element={<TicTacToeLobby user={user} />} />
            <Route path="games/tic-tac-toe/:gameId" element={<TicTacToeGame user={user} />} />
            <Route path="games/ludo" element={<LudoHome />} />
            <Route path="games/ludo/local" element={<LudoLocal />} />
            <Route path="games/ludo/history" element={<LudoHistory />} />
            <Route path="games/ludo/lobby/:gameId" element={<LudoLobby user={user} />} />
            <Route path="games/ludo/play/:gameId" element={<LudoGame user={user} />} />
            <Route path="games/play/:gameType" element={<GamePlayer />} />
            <Route path="games/challenge/:matchId" element={<ChallengeMatch />} />
            <Route path="games/review/:attemptId" element={<GameReview />} />
            <Route path="*" element={<Navigate to="blogs" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
