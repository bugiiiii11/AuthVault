import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthVaultProvider } from '@authvault/sdk';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthVaultProvider
      backendUrl={import.meta.env.VITE_AUTHVAULT_BACKEND_URL || 'http://localhost:3001'}
      supabaseUrl={import.meta.env.VITE_SUPABASE_URL}
      supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY}
    >
      <App />
    </AuthVaultProvider>
  </StrictMode>,
);
