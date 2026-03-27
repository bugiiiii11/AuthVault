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
            {/* User card */}
            <div
              className="relative p-5 rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(15, 31, 56, 0.95) 0%, rgba(15, 15, 35, 0.98) 100%)',
                border: '1px solid rgba(34, 211, 238, 0.15)',
                boxShadow: '0 0 30px rgba(34, 211, 238, 0.05), inset 0 1px 0 rgba(34, 211, 238, 0.08)',
              }}
            >
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }}
                  />
                  <span
                    className="uppercase"
                    style={{ fontFamily: 'Orbitron, monospace', fontSize: '10px', letterSpacing: '0.15em', color: '#22C55E' }}
                  >
                    Connected
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded"
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    fontSize: '9px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(34, 211, 238, 0.7)',
                    background: 'rgba(34, 211, 238, 0.08)',
                    border: '1px solid rgba(34, 211, 238, 0.15)',
                  }}
                >
                  {user.loginMethod === 'wallet' ? 'Wallet' : user.oauthProvider || 'Email'}
                </span>
              </div>

              {/* Address */}
              <p
                className="text-sm break-all mb-1"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: user.evmAddress ? '#22d3ee' : '#FB923C',
                }}
              >
                {user.evmAddress || 'Generating address...'}
              </p>

              {/* Email */}
              {user.email && (
                <p className="text-gray-400 text-sm mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {user.email}
                </p>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="w-full py-3 rounded-lg transition-all duration-300"
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                fontFamily: 'Orbitron, monospace',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Logout
            </button>
          </div>
        ) : status !== 'loading' ? (
          <div className="text-center">
            <button
              onClick={() => setShowLogin(true)}
              className="px-10 py-3.5 rounded-lg transition-all duration-300"
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '13px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontWeight: 700,
                background: 'rgba(34, 211, 238, 0.06)',
                color: '#22d3ee',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(34, 211, 238, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 211, 238, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'rgba(34, 211, 238, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(34, 211, 238, 0.08)';
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            >
              {'< Connect Wallet >'}
            </button>
          </div>
        ) : null}
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
