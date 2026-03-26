import { useState } from 'react';
import { useAuth, LoginModal } from '@signakit/sdk';

export default function App() {
  const { status, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center"
      style={{
        background: '#0F0F23',
        backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(255, 140, 0, 0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
      }}
    >
      <div className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1
            className="text-3xl tracking-widest uppercase"
            style={{
              fontFamily: 'Orbitron, monospace',
              background: 'linear-gradient(135deg, #22d3ee, #3B82F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
            }}
          >
            SignaKit
          </h1>
          <p
            className="text-xs tracking-widest uppercase text-gray-500"
            style={{ fontFamily: 'Orbitron, monospace' }}
          >
            Demo
          </p>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center">
            <svg className="w-8 h-8 animate-spin" style={{ color: 'rgba(34, 211, 238, 0.8)' }} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {status === 'authenticated' && user ? (
          <div className="space-y-4">
            <div
              className="relative p-5 rounded-lg"
              style={{
                background: '#0f1f38',
                border: '1px solid rgba(34, 211, 238, 0.15)',
              }}
            >
              <p
                className="text-gray-500 text-xs uppercase tracking-widest mb-2"
                style={{ fontFamily: 'Orbitron, monospace', fontSize: '10px' }}
              >
                Connected as
              </p>
              <p
                className="text-sm break-all mb-3"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: user.evmAddress ? '#22d3ee' : '#FB923C',
                }}
              >
                {user.evmAddress || 'Generating address...'}
              </p>
              {user.email && (
                <p className="text-gray-400 text-sm">{user.email}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: '#22C55E', boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)' }}
                />
                <p className="text-gray-500 text-xs">
                  {user.loginMethod === 'wallet' ? 'Wallet' : user.oauthProvider ? `${user.oauthProvider}` : 'Email'}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
                fontFamily: 'Orbitron, monospace',
                fontSize: '12px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase' as const,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
            >
              Logout
            </button>
          </div>
        ) : status !== 'loading' ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full py-4 rounded-lg font-bold tracking-widest uppercase transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                fontFamily: 'Orbitron, monospace',
                background: 'linear-gradient(135deg, #FF8C00, #FFB84D)',
                color: '#1a1a2e',
                boxShadow: '0 0 30px rgba(255, 140, 0, 0.2)',
                fontSize: '14px',
              }}
            >
              Connect to Play
            </button>
            <p className="text-gray-500 text-sm text-center">
              Sign in with your wallet, Google, or email
            </p>
          </div>
        ) : null}

        <p
          className="text-center"
          style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: '10px',
            letterSpacing: '0.15em',
            color: 'rgba(107, 114, 128, 0.5)',
          }}
        >
          SignaKit v0.1.0
        </p>
      </div>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => setShowLogin(false)}
        providers={{
          wallets: ['metamask', 'walletconnect'],
          social: ['google', 'email'],
        }}
        title="Connect to Play"
        subtitle="Sign in with your wallet or account"
      />
    </div>
  );
}
