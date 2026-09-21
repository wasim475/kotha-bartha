import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import "./CSS/feed.css";
import "./CSS/navbar.css";
import "./index.css";
import "./message.css";
import "./CSS/comment.css";
import "./CSS/reply.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AuthProvider from "./provider/AuthProvider.jsx";
import UtilityProvider from "./provider/UtilityProvider.jsx";
import MainRouter from "./Router/Main.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <UtilityProvider>
          <MainRouter />
        </UtilityProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
