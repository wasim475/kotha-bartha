import { useContext } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Auth } from "../provider/AuthProvider";
import AuthPage from "../pages/Auth/AuthPage";
import Shell from "../pages/Shell/Shell";
import StudyShell from "../pages/Study/StudyShell";
import PrivacyPolicy from '../pages/privacyPolicy/PrivacyPolicy';
import DataDeletion from '../pages/privacyPolicy/DataDeletation';
import TicTacToeGlobalHost from "../components/ticTacToe/TicTacToeGlobalHost";
import GameChallengeGlobalHost from "../components/gameChallenge/GameChallengeGlobalHost";

export default function MainRouter() {
  const { user, setUser, checking, logout } = useContext(Auth);

  if (checking) return <div className="loading-screen"><span className="brand-mark">ক</span><p>Preparing your space...</p></div>;

  return <BrowserRouter>{user && <TicTacToeGlobalHost key={user.id} user={user} />}{user && <GameChallengeGlobalHost key={user.id} user={user} />}<Routes>
    <Route path="privacy-policy" element={<PrivacyPolicy/>} />
    <Route path="data-deletion" element={<DataDeletion/>} />
    <Route path="/login" element={user ? <Navigate to="/app/feed" replace /> : <AuthPage mode="login" onAuth={setUser} />} />
    <Route path="/signup" element={user ? <Navigate to="/app/feed" replace /> : <AuthPage mode="signup" onAuth={setUser} />} />
    <Route path="/app/*" element={user ? <Shell user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
    <Route path="/study/*" element={user ? <StudyShell user={user} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={user ? "/app/feed" : "/login"} replace />} />
  </Routes></BrowserRouter>;
}
