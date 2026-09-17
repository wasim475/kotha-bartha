import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "./App.css";
import "./CSS/navbar.css";
import "./message.css";
import "./CSS/feed.css";
import UtilityProvider from './provider/UtilityProvider.jsx';
import AuthProvider from './provider/AuthProvider.jsx';
import MainRouter from './Router/Main.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
    <UtilityProvider>
      <MainRouter />
    </UtilityProvider>
    </AuthProvider>
  </StrictMode>
)
