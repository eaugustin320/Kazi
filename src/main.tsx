import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrototypeProvider } from './context/PrototypeContext';
import { AppShell } from './components/layout/AppShell';
import './tokens/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrototypeProvider>
      <AppShell />
    </PrototypeProvider>
  </React.StrictMode>
);
