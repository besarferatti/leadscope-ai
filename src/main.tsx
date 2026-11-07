import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { GOOGLE_CALLBACK_PATH } from './lib/googleOAuth';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === GOOGLE_CALLBACK_PATH ? <GoogleCallbackPage /> : <App />}
  </StrictMode>,
);
