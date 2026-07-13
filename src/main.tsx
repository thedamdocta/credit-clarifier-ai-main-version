
import './lib/security/hardenClientDiagnostics.ts';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import AppRuntimeBoundary from './components/AppRuntimeBoundary.tsx';
import './index.css';
import './styles/pdf-uploader.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRuntimeBoundary>
      <App />
    </AppRuntimeBoundary>
  </React.StrictMode>,
)
