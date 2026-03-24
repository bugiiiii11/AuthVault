/**
 * LoginModal -- Pre-built auth modal following Swarm Resistance design system.
 * Supports social logins (Google, Email) and wallet connections.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

type LoginView = 'main' | 'email-input' | 'email-verify' | 'wallet-select' | 'wallet-connecting';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: unknown) => void;
  providers?: {
    social?: ('google' | 'email')[];
    wallets?: ('metamask' | 'walletconnect' | 'coinbase')[];
  };
  supabaseJwt?: string;
  logo?: ReactNode;
  title?: string;
}

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  providers = { social: ['google', 'email'], wallets: ['metamask', 'walletconnect'] },
  supabaseJwt,
  logo,
  title = 'Connect to Play',
}: LoginModalProps) {
  const { status, user, error, login, sendEmailCode, verifyEmailCode } = useAuth();
  const [view, setView] = useState<LoginView>('main');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [emailSent, setEmailSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Success callback
  useEffect(() => {
    if (status === 'authenticated' && user && onSuccess) {
      onSuccess(user);
    }
  }, [status, user, onSuccess]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setView('main');
      setEmail('');
      setOtpDigits(['', '', '', '', '', '']);
      setEmailSent(false);
    }
  }, [isOpen]);

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleGoogleLogin = useCallback(async () => {
    if (!supabaseJwt) return;
    await login('google', { supabaseJwt });
  }, [login, supabaseJwt]);

  const handleEmailSubmit = useCallback(async () => {
    if (!email) return;
    try {
      await sendEmailCode(email);
      setEmailSent(true);
      setView('email-verify');
      setResendTimer(60);
    } catch { /* error handled by useAuth */ }
  }, [email, sendEmailCode]);

  const handleOtpInput = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 5 && newDigits.every(d => d)) {
      verifyEmailCode(email, newDigits.join(''));
    }
  }, [otpDigits, email, verifyEmailCode]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otpDigits]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setOtpDigits(digits);
      inputRefs.current[5]?.focus();
      verifyEmailCode(email, pasted);
    }
  }, [email, verifyEmailCode]);

  if (!isOpen) return null;

  const isLoading = status === 'loading';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="authvault-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-sm mx-4 rounded-lg overflow-hidden"
        style={{ animation: 'authvault-modal-in 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="bg-[#0f1f38] border-b border-cyan-500/30 px-5 py-4 text-center">
          {logo && <div className="mb-2">{logo}</div>}
          <h2
            id="authvault-modal-title"
            className="text-cyan-400 text-lg tracking-wide"
            style={{ fontFamily: 'Orbitron, monospace' }}
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="p-5 bg-[#0F0F23]" aria-busy={isLoading}>
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert">
              {error}
            </div>
          )}

          {/* Main view */}
          {view === 'main' && (
            <div className="space-y-3">
              {/* Social logins */}
              {providers.social?.includes('google') && (
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading || !supabaseJwt}
                  className="w-full flex items-center gap-3 p-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  aria-label="Continue with Google"
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>
              )}

              {providers.social?.includes('email') && (
                <button
                  onClick={() => setView('email-input')}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-3 bg-[#0f1f38] border border-cyan-500/20 text-white rounded-lg font-medium hover:border-cyan-500/40 hover:bg-[#1a2f4a] transition-all duration-200 disabled:opacity-50 min-h-[44px]"
                  aria-label="Continue with Email"
                >
                  <EmailIcon />
                  <span>Continue with Email</span>
                </button>
              )}

              {/* Divider */}
              {providers.wallets && providers.wallets.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-cyan-500/20" />
                  <span className="text-gray-500 text-xs uppercase tracking-widest" style={{ fontFamily: 'Orbitron, monospace' }}>
                    or
                  </span>
                  <div className="flex-1 h-px bg-cyan-500/20" />
                </div>
              )}

              {/* Wallet options */}
              {providers.wallets?.includes('metamask') && (
                <WalletButton name="MetaMask" icon={<MetaMaskIcon />} disabled={isLoading} onClick={() => {}} />
              )}
              {providers.wallets?.includes('walletconnect') && (
                <WalletButton name="WalletConnect" icon={<WalletConnectIcon />} disabled={isLoading} onClick={() => {}} />
              )}
              {providers.wallets?.includes('coinbase') && (
                <WalletButton name="Coinbase Wallet" icon={<CoinbaseIcon />} disabled={isLoading} onClick={() => {}} />
              )}
            </div>
          )}

          {/* Email input view */}
          {view === 'email-input' && (
            <div className="space-y-4">
              <button onClick={() => setView('main')} className="text-cyan-400 text-sm hover:text-cyan-300 transition">
                &larr; Back
              </button>
              <div>
                <label htmlFor="authvault-email" className="block text-gray-400 text-sm mb-2">
                  Email address
                </label>
                <input
                  id="authvault-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                  className="w-full bg-[#0f1f38] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 min-h-[44px] transition-all duration-300 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleEmailSubmit}
                disabled={isLoading || !email}
                className="w-full py-3 bg-gradient-to-r from-[#FF8C00] to-[#FFB84D] text-gray-900 rounded-lg font-bold tracking-widest uppercase min-h-[44px] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'Orbitron, monospace' }}
              >
                {isLoading ? <Spinner /> : 'Send Code'}
              </button>
            </div>
          )}

          {/* Email verify view */}
          {view === 'email-verify' && (
            <div className="space-y-4">
              <button onClick={() => { setView('email-input'); setOtpDigits(['', '', '', '', '', '']); }} className="text-cyan-400 text-sm hover:text-cyan-300 transition">
                &larr; Back
              </button>
              <p className="text-gray-300 text-sm text-center">
                Enter the 6-digit code sent to <span className="text-cyan-400">{email}</span>
              </p>

              {/* OTP inputs */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    disabled={isLoading}
                    className="w-12 h-14 text-center text-xl bg-[#0f1f38] border border-cyan-500/20 rounded-lg text-white transition-all duration-200 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none disabled:opacity-50"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    aria-label={`Digit ${i + 1} of 6`}
                  />
                ))}
              </div>

              {/* Resend */}
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-gray-500 text-sm">Resend in {resendTimer}s</p>
                ) : (
                  <button
                    onClick={() => { handleEmailSubmit(); setResendTimer(60); }}
                    className="text-cyan-400 text-sm hover:text-cyan-300 transition"
                  >
                    Resend code
                  </button>
                )}
              </div>

              {isLoading && (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 bg-[#0F0F23] text-center">
          <p className="text-gray-600 text-xs">Secured by AuthVault</p>
        </div>
      </div>

      <style>{`
        @keyframes authvault-modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// -- Sub-components --

function WalletButton({ name, icon, disabled, onClick }: { name: string; icon: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 p-3 bg-[#0f1f38] border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 hover:bg-[#1a2f4a] transition-all duration-300 group disabled:opacity-50 min-h-[44px]"
      aria-label={`Connect with ${name}`}
    >
      <span className="w-7 h-7 flex items-center justify-center">{icon}</span>
      <span className="text-white group-hover:text-cyan-400 transition font-medium">{name}</span>
      <svg className="ml-auto w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// -- Icons (inline SVG to avoid external deps) --

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function MetaMaskIcon() {
  return <svg className="w-7 h-7" viewBox="0 0 24 24"><path fill="#E2761B" d="M20.4 3L13 8.4l1.4-3.3L20.4 3z"/><path fill="#E4761B" d="M3.6 3l7.3 5.5L9.6 5.1 3.6 3z"/><path fill="#D7C1B3" d="M17.8 16.5l-2 3 4.2 1.2 1.2-4.1-3.4-.1zM2.8 16.6l1.2 4.1 4.2-1.2-2-3-3.4.1z"/></svg>;
}

function WalletConnectIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24">
      <path fill="#3B99FC" d="M6.09 8.55c3.26-3.19 8.56-3.19 11.82 0l.39.38a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53a5.94 5.94 0 00-8.24 0l-.58.56a.21.21 0 01-.3 0L5.67 9.54a.4.4 0 010-.58l.42-.41zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.42.42 0 01-.59 0l-3.82-3.74a.1.1 0 00-.15 0l-3.82 3.74a.42.42 0 01-.59 0L2.16 13a.4.4 0 010-.58l1.2-1.17a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0z"/>
    </svg>
  );
}

function CoinbaseIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24">
      <circle fill="#0052FF" cx="12" cy="12" r="10"/>
      <path fill="white" d="M12 6a6 6 0 100 12 6 6 0 000-12zm-1.5 3.5h3a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5z"/>
    </svg>
  );
}
