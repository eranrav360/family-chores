import { useState } from 'react';
import { createMember } from '../../api';
import { useApp } from '../../context/AppContext';

const AVATAR_OPTIONS = [
  '🦁','🐯','🐼','🐸','🦊','🐶','🐱','🦄',
  '🐻','🐨','🐰','🦋','🌸','⭐','🌈','🎮',
  '⚽','🎨','🚀','🦸','🧸','🎪','🏆','🐲',
];

interface ChildForm {
  name: string;
  avatar_emoji: string;
}

export default function SetupScreen() {
  const { refreshFamily } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [child1, setChild1] = useState<ChildForm>({ name: '', avatar_emoji: '🦁' });
  const [child2, setChild2] = useState<ChildForm>({ name: '', avatar_emoji: '🐯' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentChild = step === 1 ? child1 : child2;
  const setCurrentChild = step === 1 ? setChild1 : setChild2;

  const handleNext = () => {
    if (!currentChild.name.trim()) {
      setError('יש להזין שם');
      return;
    }
    setError(null);
    if (step === 1) setStep(2);
  };

  const handleSubmit = async () => {
    if (!child2.name.trim()) { setError('יש להזין שם'); return; }
    setLoading(true);
    setError(null);
    try {
      await createMember({ name: child1.name.trim(), avatar_emoji: child1.avatar_emoji });
      await createMember({ name: child2.name.trim(), avatar_emoji: child2.avatar_emoji });
      await refreshFamily();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת הפרופילים');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🏠</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, marginBottom: 8 }}>ברוכים הבאים!</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
            בואו נגדיר את הילדים של הבית
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ width: 32, height: 6, borderRadius: 3, background: step >= s ? '#FCD34D' : 'rgba(255,255,255,0.3)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: 'center', color: 'var(--primary)' }}>
            {step === 1 ? '👦 ילד ראשון' : '👧 ילד שני'}
          </h2>

          {/* Name */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">שם הילד/ה</label>
            <input
              className="input"
              type="text"
              placeholder="הכנס שם..."
              value={currentChild.name}
              onChange={(e) => setCurrentChild((c) => ({ ...c, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') step === 1 ? handleNext() : handleSubmit(); }}
              autoFocus
              maxLength={30}
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="label">בחר אמוג׳י</label>
            <div className="emoji-grid">
              {AVATAR_OPTIONS.map((em) => (
                <button
                  key={em}
                  className={`emoji-btn${currentChild.avatar_emoji === em ? ' selected' : ''}`}
                  onClick={() => setCurrentChild((c) => ({ ...c, avatar_emoji: em }))}
                  type="button"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ textAlign: 'center', margin: '20px 0', padding: '16px', background: 'var(--bg)', borderRadius: 12 }}>
            <div style={{ fontSize: 48 }}>{currentChild.avatar_emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              {currentChild.name || '...'}
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

          {step === 1 ? (
            <button className="btn btn-primary btn-full" onClick={handleNext}>
              הבא ← ילד שני
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
                {loading ? 'יוצר פרופילים...' : '🚀 בואו נתחיל!'}
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => { setError(null); setStep(1); }}>
                → חזור לילד ראשון
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
