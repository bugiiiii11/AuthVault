import { useState, useCallback } from 'react';
import { useAuth, useSigning, LoginModal, getOrCreateEncryptionKey } from '@authvault/sdk';

export default function App() {
  const { status, user, logout } = useAuth();
  const { signMessage } = useSigning();
  const [showLogin, setShowLogin] = useState(false);
  const [sigResult, setSigResult] = useState<string | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSignTest = useCallback(async () => {
    if (!user) return;
    setSigning(true);
    setSigResult(null);
    setSigError(null);

    try {
      const message = `AuthVault sign test\nAddress: ${user.evmAddress}\nTimestamp: ${Date.now()}`;
      const msgBytes = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBytes);
      const msgHash = new Uint8Array(hashBuffer);

      const encKey = await getOrCreateEncryptionKey(user.id);
      const { signature } = await signMessage(msgHash, encKey);
      setSigResult(signature);
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  }, [user, signMessage]);

  return (
    <div className="min-h-screen bg-[#0F0F23] text-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 space-y-6">
        <h1
          className="text-3xl font-bold text-center text-cyan-400 tracking-wide"
          style={{ fontFamily: 'Orbitron, monospace' }}
        >
          AuthVault Demo
        </h1>

        {status === 'loading' && (
          <div className="flex justify-center">
            <svg className="w-8 h-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {status === 'authenticated' && user ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#0f1f38] border border-cyan-500/20 rounded-lg">
              <p className="text-gray-400 text-sm mb-1">Connected as</p>
              <p className="font-mono text-sm break-all text-cyan-400">
                {user.evmAddress || 'No address yet'}
              </p>
              {user.email && (
                <p className="text-gray-400 text-sm mt-2">{user.email}</p>
              )}
              <p className="text-gray-500 text-xs mt-2">
                Login: {user.loginMethod} {user.oauthProvider ? `(${user.oauthProvider})` : ''}
              </p>
            </div>

            {/* Sign test -- only for social/email users who have Shamir keys */}
            {user.loginMethod !== 'wallet' && user.evmAddress && (
              <div className="space-y-3">
                <button
                  onClick={handleSignTest}
                  disabled={signing}
                  className="w-full py-3 px-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg font-medium hover:bg-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing...
                    </span>
                  ) : 'Test: Sign Message'}
                </button>

                {sigResult && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-1">
                    <p className="text-green-400 text-xs font-medium">Signature (secp256k1):</p>
                    <p className="font-mono text-xs text-green-300 break-all">{sigResult}</p>
                    <p className="text-gray-500 text-xs">SSS reconstruction + signing: OK</p>
                  </div>
                )}

                {sigError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-xs">{sigError}</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={logout}
              className="w-full py-3 px-4 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg font-medium hover:bg-red-600/30 transition-all duration-200"
            >
              Logout
            </button>
          </div>
        ) : status !== 'loading' ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowLogin(true)}
              className="w-full py-4 bg-gradient-to-r from-[#FF8C00] to-[#FFB84D] text-gray-900 rounded-lg font-bold tracking-widest uppercase transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ fontFamily: 'Orbitron, monospace' }}
            >
              Connect to Play
            </button>
            <p className="text-gray-500 text-sm text-center">
              Sign in with Google, Email, or connect your wallet
            </p>
          </div>
        ) : null}

        <p className="text-xs text-gray-600 text-center">AuthVault MVP v0.1.0</p>
      </div>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => setShowLogin(false)}
        providers={{
          social: ['google', 'email'],
          wallets: ['metamask', 'walletconnect'],
        }}
        title="Connect to Play"
      />
    </div>
  );
}
