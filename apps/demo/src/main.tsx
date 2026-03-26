import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SignaKitProvider } from '@signakit/sdk';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SignaKitProvider
      backendUrl={import.meta.env.VITE_SIGNAKIT_BACKEND_URL || import.meta.env.VITE_AUTHVAULT_BACKEND_URL || 'http://localhost:3001'}
      supabaseUrl={import.meta.env.VITE_SUPABASE_URL}
      supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY}
      walletConnectProjectId={import.meta.env.VITE_WALLETCONNECT_PROJECT_ID}
    >
      <App />
    </SignaKitProvider>
  </StrictMode>,
);
