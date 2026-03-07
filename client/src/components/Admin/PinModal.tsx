import { useState, useRef, useEffect } from 'react';

interface Props {
  onVerify: (pin: string) => Promise<boolean>;
  verifying: boolean;
  error: string | null;
  onClearError: () => void;
}

export default function PinModal({ onVerify, verifying, error, onClearError }: Props) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { refs[0].current?.focus(); }, []);

  const handleChange = async (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    onClearError();
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 3) refs[i + 1].current?.focus();

    // Auto-submit when all filled
    if (val && i === 3) {
      const pin = [...next.slice(0, 3), val].join('');
      if (pin.length === 4) {
        const ok = await onVerify(pin);
        if (!ok) {
          setDigits(['', '', '', '']);
          refs[0].current?.focus();
        }
      }
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
  };

  const handleSubmit = async () => {
    const pin = digits.join('');
    if (pin.length < 4) return;
    const ok = await onVerify(pin);
    if (!ok) {
      setDigits(['', '', '', '']);
      refs[0].current?.focus();
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔐</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>הגדרות הורים</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          הזן את קוד ה-PIN כדי להיכנס
        </p>

        <div className="pin-row">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              className={`pin-digit${d ? ' has-val' : ''}${error ? ' error-border' : ''}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleSubmit}
          disabled={verifying || digits.join('').length < 4}
        >
          {verifying ? 'בודק...' : 'כניסה'}
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-light)' }}>
          ברירת מחדל: 1234
        </p>
      </div>
    </div>
  );
}
