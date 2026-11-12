import React from 'react';
import ReactDOM from 'react-dom/client';
import { LanguageProvider } from './contexts/LanguageContext';
import App from './App.tsx';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <SupabaseAuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </SupabaseAuthProvider>
    </React.StrictMode>
  );
}