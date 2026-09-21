import { useContext } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Auth } from "../provider/AuthProvider";
import AuthPage from "../pages/Auth/AuthPage";
import Shell from "../pages/Shell/Shell";
import PrivacyPolicy from '../pages/privacyPolicy/PrivacyPolicy';
import DataDeletion from '../pages/privacyPolicy/DataDeletation';

export default function MainRouter() {
  const { user, setUser, checking, logout } = useContext(Auth);

  if (checking) return <div className="loading-screen"><span className="brand-mark">ক</span><p>Preparing your space...</p></div>;

  return <BrowserRouter><Routes>
    <Route path="privacy-policy" element={<PrivacyPolicy/>} />
    <Route path="data-deletion" element={<DataDeletion/>} />
    <Route path="/login" element={user ? <Navigate to="/app/feed" replace /> : <AuthPage mode="login" onAuth={setUser} />} />
    <Route path="/signup" element={user ? <Navigate to="/app/feed" replace /> : <AuthPage mode="signup" onAuth={setUser} />} />
    <Route path="/app/*" element={user ? <Shell user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={user ? "/app/feed" : "/login"} replace />} />
  </Routes></BrowserRouter>;
}
