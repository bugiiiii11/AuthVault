import { useAuth } from '@authvault/sdk';

export default function App() {
  const { status, user, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="max-w-md w-full p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center">AuthVault Demo</h1>

        {status === 'authenticated' && user ? (
          <div className="space-y-4 text-center">
            <p className="text-slate-300">Connected as</p>
            <p className="font-mono text-sm break-all text-blue-400">{user.evmAddress}</p>
            <button
              onClick={logout}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => login('google')}
              className="w-full py-3 px-4 bg-white text-black rounded-xl font-medium hover:bg-slate-100 transition"
            >
              Continue with Google
            </button>
            <button
              onClick={() => login('email')}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition"
            >
              Continue with Email
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center">AuthVault MVP v0.1.0</p>
      </div>
    </div>
  );
}
