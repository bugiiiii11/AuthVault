/**
 * LoginModal -- Swarm Resistance HUD glass design.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { useSignaKitContext } from '../SignaKitProvider';
import type { WalletProvider } from '@signakit/types';

type LoginView = 'main' | 'email-input' | 'email-verify';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: unknown) => void;
  onGoogleLogin?: () => void | Promise<void>;
  providers?: {
    social?: ('google' | 'email')[];
    wallets?: ('metamask' | 'walletconnect' | 'coinbase')[];
  };
  logo?: ReactNode;
  title?: string;
}

const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];
function isGmailAddress(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return GMAIL_DOMAINS.includes(domain);
}

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  onGoogleLogin: externalGoogleLogin,
  providers = { wallets: ['metamask', 'walletconnect'], social: ['google', 'email'] },
  logo,
  title = 'Sign In',
}: LoginModalProps) {
  const { status, user, error, sendEmailCode, verifyEmailCode } = useAuth();
  const { connect, isConnecting, error: walletError } = useWallet();
  const { supabaseClient } = useSignaKitContext();
  const [view, setView] = useState<LoginView>('main');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const [gmailWarning, setGmailWarning] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (status === 'authenticated' && user && onSuccess) onSuccess(user);
  }, [status, user, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setView('main'); setEmail(''); setOtpDigits(['', '', '', '', '', '']);
      setGmailWarning(false); setConnectingWallet(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleGoogleLogin = useCallback(async () => {
    // Use external handler if provided (e.g. bridge with its own Supabase singleton)
    if (externalGoogleLogin) {
      await externalGoogleLogin();
      return;
    }
    if (!supabaseClient) return;
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, [supabaseClient, externalGoogleLogin]);

  const handleWalletConnect = useCallback(async (provider: WalletProvider) => {
    setConnectingWallet(provider);
    try { await connect(provider); } finally { setConnectingWallet(null); }
  }, [connect]);

  const handleEmailSubmit = useCallback(async () => {
    if (!email) return;
    if (isGmailAddress(email)) { setGmailWarning(true); return; }
    setGmailWarning(false);
    try {
      await sendEmailCode(email);
      setView('email-verify'); setResendTimer(60);
    } catch { /* handled by useAuth */ }
  }, [email, sendEmailCode]);

  const handleOtpInput = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5 && newDigits.every(d => d)) verifyEmailCode(email, newDigits.join(''));
  }, [otpDigits, email, verifyEmailCode]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }, [otpDigits]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
      verifyEmailCode(email, pasted);
    }
  }, [email, verifyEmailCode]);

  if (!isOpen) return null;

  const isLoading = status === 'loading' || isConnecting;
  const displayError = error || walletError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-labelledby="sk-title"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="relative" style={{ animation: 'sk-in 0.3s ease-out', width: '100%', maxWidth: '500px' }}>
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(15,31,56,0.95) 0%, rgba(15,15,35,0.98) 100%)',
            border: '1px solid rgba(34,211,238,0.2)',
            boxShadow: '0 0 60px rgba(34,211,238,0.08), 0 0 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(34,211,238,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <HUDCorners />

          {/* Top accent */}
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)' }} />

          {/* Header */}
          <div className="relative px-8 pt-7 pb-5 text-center">
            {/* Close */}
            <button
              onClick={onClose}
              style={{ position: 'absolute', top: '20px', right: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', transition: 'all 0.2s', color: 'rgba(156,163,175,0.6)', border: '1px solid rgba(34,211,238,0.12)', background: 'rgba(15,31,56,0.5)', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(34,211,238,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(156,163,175,0.6)'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
              aria-label="Close"
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {logo && <div className="mb-4">{logo}</div>}
            <div className="flex justify-center mb-3"><div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }} /></div>
            <h2 id="sk-title" className="text-2xl tracking-[0.2em] uppercase" style={{ fontFamily: 'Orbitron, monospace', color: '#22d3ee', textShadow: '0 0 25px rgba(34,211,238,0.3)' }}>
              {title}
            </h2>
          </div>

          {/* Content */}
          <div className="px-10 pt-2 pb-12" aria-busy={isLoading}>

            {displayError && (
              <div role="alert" style={{ marginBottom: '20px', padding: '14px', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <svg style={{ width: '18px', height: '18px', minWidth: '18px', marginTop: '2px' }} fill="none" viewBox="0 0 24 24" stroke="#f87171"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <span style={{ color: '#f87171', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{displayError}</span>
              </div>
            )}

            {/* ======== MAIN ======== */}
            {view === 'main' && (
              <div className="space-y-6">
                {providers.wallets && providers.wallets.length > 0 && (
                  <div className="space-y-3">
                    <Label text="Wallet" />
                    {providers.wallets?.includes('metamask') && (
                      <Btn onClick={() => handleWalletConnect('metamask')} text="MetaMask" disabled={isLoading} loading={connectingWallet === 'metamask'} icon={<MetaMaskIcon />} />
                    )}
                    {providers.wallets?.includes('walletconnect') && (
                      <Btn onClick={() => handleWalletConnect('walletconnect')} text="WalletConnect" disabled={isLoading} loading={connectingWallet === 'walletconnect'} icon={<WalletConnectIcon />} />
                    )}
                    {providers.wallets?.includes('coinbase') && (
                      <Btn onClick={() => handleWalletConnect('coinbase')} text="Coinbase" disabled={isLoading} loading={connectingWallet === 'coinbase'} icon={<CoinbaseIcon />} />
                    )}
                  </div>
                )}
                {providers.social && providers.social.length > 0 && (
                  <div className="space-y-3">
                    <Label text="Social" />
                    {providers.social?.includes('google') && (
                      <Btn onClick={handleGoogleLogin} text="Google" disabled={isLoading || !supabaseClient} icon={<GoogleIcon />} />
                    )}
                    {providers.social?.includes('email') && (
                      <Btn onClick={() => setView('email-input')} text="Email" disabled={isLoading} icon={<EmailIcon />} />
                    )}
                  </div>
                )}
                {isConnecting && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px 0 4px' }}>
                    <Spinner /><span style={{ color: '#22d3ee', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Confirm in your wallet...</span>
                  </div>
                )}
              </div>
            )}

            {/* ======== EMAIL INPUT ======== */}
            {view === 'email-input' && (
              <div className="space-y-5">
                <div className="-ml-2"><Back onClick={() => { setView('main'); setGmailWarning(false); }} /></div>
                <div>
                  <label htmlFor="sk-email" style={{ fontFamily: 'Orbitron, monospace', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(156,163,175,0.5)', display: 'block', marginBottom: '8px' }}>
                    Email address
                  </label>
                  <input
                    id="sk-email" type="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setGmailWarning(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
                    placeholder="you@example.com" autoComplete="email" autoFocus disabled={isLoading}
                    className="w-full rounded-lg px-4 py-3.5 text-white placeholder-gray-600 transition-all duration-300 focus:outline-none disabled:opacity-50"
                    style={{ fontFamily: 'Inter, sans-serif', background: 'rgba(15,31,56,0.6)', border: gmailWarning ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(34,211,238,0.15)', fontSize: '16px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}
                    onFocus={(e) => { if (!gmailWarning) { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'; e.currentTarget.style.boxShadow = 'inset 0 0 20px rgba(0,0,0,0.2), 0 0 12px rgba(34,211,238,0.08)'; }}}
                    onBlur={(e) => { if (!gmailWarning) { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.15)'; e.currentTarget.style.boxShadow = 'inset 0 0 20px rgba(0,0,0,0.2)'; }}}
                  />
                </div>
                {gmailWarning && (
                  <div className="space-y-4">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px', borderRadius: '8px', background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}>
                      <svg style={{ width: '18px', height: '18px', minWidth: '18px', marginTop: '2px' }} fill="none" viewBox="0 0 24 24" stroke="#FB923C"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span style={{ color: '#d1d5db', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>Gmail accounts work best with Google login.</span>
                    </div>
                    <Btn onClick={handleGoogleLogin} text="Continue with Google" icon={<GoogleIcon />} />
                  </div>
                )}
                {!gmailWarning && <Btn onClick={handleEmailSubmit} disabled={isLoading || !email} text={isLoading ? undefined : 'Send Code'} loading={isLoading} />}
              </div>
            )}

            {/* ======== OTP VERIFY ======== */}
            {view === 'email-verify' && (
              <div className="space-y-6">
                <div className="-ml-2"><Back onClick={() => { setView('email-input'); setOtpDigits(['', '', '', '', '', '']); }} /></div>
                <div className="text-center">
                  <p className="text-gray-400" style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px' }}>Enter the 6-digit code sent to</p>
                  <p className="mt-1.5" style={{ color: '#22d3ee', fontFamily: 'JetBrains Mono, monospace', fontSize: '15px' }}>{email}</p>
                </div>
                <div className="max-w-[300px] mx-auto">
                  <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input key={i} ref={(el) => { inputRefs.current[i] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        autoFocus={i === 0} disabled={isLoading}
                        style={{ width: '44px', height: '52px', textAlign: 'center', fontSize: '22px', color: 'white', borderRadius: '8px', transition: 'all 0.2s', outline: 'none', opacity: isLoading ? 0.5 : 1, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(15,31,56,0.6)', border: digit ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(34,211,238,0.15)', boxShadow: digit ? '0 0 12px rgba(34,211,238,0.1)' : 'inset 0 0 10px rgba(0,0,0,0.2)' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.5)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(34,211,238,0.12)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = digit ? 'rgba(34,211,238,0.5)' : 'rgba(34,211,238,0.15)'; e.currentTarget.style.boxShadow = digit ? '0 0 12px rgba(34,211,238,0.1)' : 'inset 0 0 10px rgba(0,0,0,0.2)'; }}
                        aria-label={`Digit ${i + 1} of 6`}
                      />
                    ))}
                  </div>
                </div>
                {resendTimer > 0
                  ? <Btn onClick={() => {}} text={`Resend in ${resendTimer}s`} disabled />
                  : <Btn onClick={() => { handleEmailSubmit(); setResendTimer(60); }} text="Resend Code" />
                }
                {isLoading && (
                  <div className="flex items-center justify-center gap-3">
                    <Spinner /><span style={{ color: '#22d3ee', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Verifying...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom accent */}
          <div style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.2), transparent)' }} />
        </div>
      </div>

      <style>{`
        @keyframes sk-in { from { opacity: 0; transform: scale(0.92) translateY(-12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes sk-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ============================================================

function HUDCorners() {
  const C = ({ t, r, b, l }: { t?: boolean; r?: boolean; b?: boolean; l?: boolean }) => (
    <span style={{ position: 'absolute', top: t ? '0' : undefined, bottom: b ? '0' : undefined, left: l ? '0' : undefined, right: r ? '0' : undefined, width: '18px', height: '18px', zIndex: 10, pointerEvents: 'none' }}>
      <span style={{ position: 'absolute', [t ? 'top' : 'bottom']: 0, [l ? 'left' : 'right']: 0, width: '18px', height: '1px', background: 'rgba(34,211,238,0.5)' }} />
      <span style={{ position: 'absolute', [t ? 'top' : 'bottom']: 0, [l ? 'left' : 'right']: 0, width: '1px', height: '18px', background: 'rgba(34,211,238,0.5)' }} />
      <span style={{ position: 'absolute', [t ? 'top' : 'bottom']: '-1px', [l ? 'left' : 'right']: '-1px', width: '3px', height: '3px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px rgba(34,211,238,0.8)', animation: 'sk-glow 3s ease-in-out infinite' }} />
    </span>
  );
  return <><C t l /><C t r /><C b l /><C b r /></>;
}

function Label({ text }: { text: string }) {
  return <p style={{ fontFamily: 'Orbitron, monospace', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(156,163,175,0.45)', paddingLeft: '2px' }}>{text}</p>;
}

function Btn({ onClick, disabled, text, loading, icon }: {
  onClick: () => void; disabled?: boolean; text?: string; loading?: boolean; icon?: ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-3.5 rounded-lg min-h-[52px] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-4"
      style={{ fontFamily: 'Orbitron, monospace', fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, background: 'rgba(34,211,238,0.06)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)', boxShadow: '0 0 15px rgba(34,211,238,0.06)' }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'rgba(34,211,238,0.12)'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.45)'; e.currentTarget.style.boxShadow = '0 0 25px rgba(34,211,238,0.12)'; }}}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(34,211,238,0.06)'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.25)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(34,211,238,0.06)'; }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
    >
      {loading ? <Spinner /> : <>{icon && <span style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>}{text && <span>{'< '}{text}{' >'}</span>}</>}
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-all duration-200"
      style={{ color: 'rgba(34,211,238,0.6)', fontFamily: 'Orbitron, monospace', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(34,211,238,0.12)', background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'; e.currentTarget.style.background = 'rgba(34,211,238,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(34,211,238,0.6)'; e.currentTarget.style.borderColor = 'rgba(34,211,238,0.12)'; e.currentTarget.style.background = 'transparent'; }}
    >
      <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
      Back
    </button>
  );
}

function Spinner({ color = 'rgba(34,211,238,0.9)', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg className="animate-spin" style={{ width: size, height: size, display: 'inline-block' }} fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke={color} strokeWidth="3" />
      <path style={{ opacity: 0.85 }} fill={color} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ============================================================
// Icons
// ============================================================

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
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="rgba(34,211,238,0.7)">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function MetaMaskIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 35 33">
      <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="M32.96 1l-13.14 9.72 2.45-5.73L32.96 1z"/>
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="M2.66 1l13.02 9.81L13.35 4.99 2.66 1zM28.23 23.53l-3.5 5.34 7.49 2.06 2.14-7.28-6.13-.12zM.92 23.65l2.13 7.28 7.47-2.06-3.48-5.34-6.12.12z"/>
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="M10.15 14.51l-2.09 3.17 7.44.34-.26-8-5.09 4.49zM25.46 14.51l-5.17-4.58-.17 8.09 7.44-.34-2.1-3.17zM10.52 28.87l4.49-2.16-3.88-3.03-.61 5.19zM20.61 26.71l4.47 2.16-.59-5.19-3.88 3.03z"/>
      <path fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" d="M25.08 28.87l-4.47-2.16.36 2.91-.04 1.23 4.15-1.98zM10.52 28.87l4.16 1.98-.03-1.23.34-2.91-4.47 2.16z"/>
      <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="M14.76 21.86l-3.75-1.1 2.65-1.22 1.1 2.32zM20.86 21.86l1.1-2.32 2.66 1.22-3.76 1.1z"/>
      <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="M10.52 28.87l.64-5.34-4.12.12 3.48 5.22zM24.44 23.53l.64 5.34 3.5-5.22-4.14-.12zM27.56 17.68l-7.44.34.69 3.84 1.1-2.32 2.66 1.22 2.99-3.08zM11.01 20.76l2.65-1.22 1.1 2.32.69-3.84-7.44-.34 2.99 3.08z"/>
      <path fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" d="M8.01 17.68l3.12 6.08-.11-3.04-3.01-3.04zM24.57 20.72l-.12 3.04 3.11-6.08-2.99 3.04zM15.46 18.02l-.69 3.84.87 4.49.2-5.91-.38-2.42zM20.12 18.02l-.37 2.41.18 5.92.87-4.49-.68-3.84z"/>
      <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="M20.81 21.86l-.87 4.49.62.44 3.88-3.03.12-3.04-3.75 1.14zM11.01 20.72l.11 3.04 3.88 3.03.62-.44-.87-4.49-3.74-1.14z"/>
      <path fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" d="M20.85 30.85l.04-1.23-.34-.29h-5.48l-.32.29.03 1.23-4.16-1.98 1.46 1.19 2.95 2.04h5.57l2.96-2.04 1.44-1.19-4.15 1.98z"/>
      <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="M20.61 26.71l-.62-.44h-4.36l-.62.44-.34 2.91.32-.29h5.48l.34.29-.2-2.91z"/>
      <path fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" d="M33.52 11.35l1.1-5.36L32.96 1l-12.35 9.17 4.76 4.02 6.72 1.97 1.48-1.73-.64-.47 1.03-.94-.79-.61 1.03-.79-.68-.51zM.99 5.99l1.11 5.36-.71.51 1.03.79-.79.61 1.03.94-.64.47 1.48 1.73 6.72-1.97 4.76-4.02L2.66 1 .99 5.99z"/>
      <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="M32.09 16.16l-6.72-1.97 2.09 3.17-3.11 6.08 4.09-.05h6.13l-2.48-7.23zM10.15 14.19l-6.72 1.97-2.43 7.23h6.12l4.08.05-3.12-6.08 2.07-3.17zM20.12 18.02l.43-7.49 1.94-5.24H13.35l1.93 5.24.45 7.49.17 2.43.01 5.9h4.36l.02-5.9.18-2.43z"/>
    </svg>
  );
}

function WalletConnectIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path fill="#3B99FC" d="M6.09 8.55c3.26-3.19 8.56-3.19 11.82 0l.39.38a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53a5.94 5.94 0 00-8.24 0l-.58.56a.21.21 0 01-.3 0L5.67 9.54a.4.4 0 010-.58l.42-.41zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.42.42 0 01-.59 0l-3.82-3.74a.1.1 0 00-.15 0l-3.82 3.74a.42.42 0 01-.59 0L2.16 13a.4.4 0 010-.58l1.2-1.17a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0z"/>
    </svg>
  );
}

function CoinbaseIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <circle fill="#0052FF" cx="12" cy="12" r="10"/>
      <path fill="white" d="M12 6a6 6 0 100 12 6 6 0 000-12zm-1.5 3.5h3a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5z"/>
    </svg>
  );
}
