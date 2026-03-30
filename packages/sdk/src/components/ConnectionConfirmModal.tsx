/**
 * ConnectionConfirmModal -- HUD glass confirmation shown after successful login.
 * Matches the LoginModal / "Access Required" design system.
 * All styles are inline (SDK Tailwind classes aren't processed by host apps).
 */

interface ConnectionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
  loginMethod?: string | null;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectionConfirmModal({
  isOpen,
  onClose,
  walletAddress,
  loginMethod,
}: ConnectionConfirmModalProps) {
  if (!isOpen) return null;

  const isWallet = loginMethod === 'wallet';
  const heading = isWallet ? 'Wallet Connected' : 'Connected';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-confirm-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          animation: 'sk-in 0.3s ease-out',
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(15,31,56,0.95) 0%, rgba(15,15,35,0.98) 100%)',
            border: '1px solid rgba(34,211,238,0.2)',
            boxShadow: '0 0 60px rgba(34,211,238,0.08), 0 0 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(34,211,238,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <HUDCorners />

          {/* Top accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '15%',
              right: '15%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)',
            }}
          />

          {/* Content */}
          <div style={{ padding: '40px 32px 36px', textAlign: 'center' }}>

            {/* Animated icon */}
            <div
              style={{
                margin: '0 auto 24px',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '2px solid rgba(34,211,238,0.4)',
                background: 'rgba(34,211,238,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: '0 0 30px rgba(34,211,238,0.3)',
                animation: 'sk-pulse 2s ease-in-out infinite',
              }}
            >
              <CheckIcon />
              {/* Expanding ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(34,211,238,0.2)',
                  animation: 'sk-ring 2s ease-in-out infinite',
                }}
              />
            </div>

            {/* Heading */}
            <h2
              id="sk-confirm-title"
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#22d3ee',
                textShadow: '0 0 25px rgba(34,211,238,0.3)',
                margin: '0 0 16px',
              }}
            >
              {heading}
            </h2>

            {/* Divider */}
            <div
              style={{
                width: '40px',
                height: '2px',
                margin: '0 auto 20px',
                background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)',
              }}
            />

            {/* Wallet address */}
            {walletAddress && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.15)',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#22d3ee',
                    boxShadow: '0 0 8px rgba(34,211,238,0.6)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '15px',
                    color: '#22d3ee',
                    letterSpacing: '0.04em',
                  }}
                >
                  {truncateAddress(walletAddress)}
                </span>
              </div>
            )}

            {/* OK button */}
            <div>
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: '14px 24px',
                  borderRadius: '8px',
                  minHeight: '52px',
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '13px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  background: 'rgba(34,211,238,0.1)',
                  color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.35)',
                  boxShadow: '0 0 20px rgba(34,211,238,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(34,211,238,0.18)';
                  e.currentTarget.style.borderColor = 'rgba(34,211,238,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(34,211,238,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(34,211,238,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)';
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              >
                {'< OK >'}
              </button>
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '15%',
              right: '15%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.2), transparent)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes sk-in { from { opacity: 0; transform: scale(0.92) translateY(-12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes sk-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes sk-pulse { 0%, 100% { box-shadow: 0 0 20px rgba(34,211,238,0.3); } 50% { box-shadow: 0 0 40px rgba(34,211,238,0.6); } }
        @keyframes sk-ring { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.3); opacity: 0; } }
      `}</style>
    </div>
  );
}

// -- Sub-components --

function HUDCorners() {
  const C = ({ t, r, b, l }: { t?: boolean; r?: boolean; b?: boolean; l?: boolean }) => (
    <span
      style={{
        position: 'absolute',
        top: t ? '0' : undefined,
        bottom: b ? '0' : undefined,
        left: l ? '0' : undefined,
        right: r ? '0' : undefined,
        width: '18px',
        height: '18px',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          [t ? 'top' : 'bottom']: 0,
          [l ? 'left' : 'right']: 0,
          width: '18px',
          height: '1px',
          background: 'rgba(34,211,238,0.5)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          [t ? 'top' : 'bottom']: 0,
          [l ? 'left' : 'right']: 0,
          width: '1px',
          height: '18px',
          background: 'rgba(34,211,238,0.5)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          [t ? 'top' : 'bottom']: '-1px',
          [l ? 'left' : 'right']: '-1px',
          width: '3px',
          height: '3px',
          borderRadius: '50%',
          background: '#22d3ee',
          boxShadow: '0 0 6px rgba(34,211,238,0.8)',
          animation: 'sk-glow 3s ease-in-out infinite',
        }}
      />
    </span>
  );
  return (
    <>
      <C t l />
      <C t r />
      <C b l />
      <C b r />
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22d3ee"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
