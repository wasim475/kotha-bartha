import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UtilityProvider from './provider/UtilityProvider.jsx';
import AuthProvider from './provider/AuthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
    <UtilityProvider>
      <App />
    </UtilityProvider>
    </AuthProvider>
  </StrictMode>
)
