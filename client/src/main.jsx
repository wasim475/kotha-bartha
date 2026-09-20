import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import "./CSS/feed.css";
import "./CSS/navbar.css";
import "./index.css";
import "./message.css";
import "./CSS/comment.css";
import "./CSS/reply.css";

import AuthProvider from "./provider/AuthProvider.jsx";
import UtilityProvider from "./provider/UtilityProvider.jsx";
import MainRouter from "./Router/Main.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <UtilityProvider>
        <MainRouter />
      </UtilityProvider>
    </AuthProvider>
  </StrictMode>,
);
