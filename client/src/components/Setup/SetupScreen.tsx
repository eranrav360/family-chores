import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFamily, createMember, checkFamilyCode } from '../../api';
import type { Family } from '../../types';

const AVATAR_OPTIONS = [
  '🦁','🐯','🐼','🐸','🦊','🐶','🐱','🦄',
  '🐻','🐨','🐰','🦋','🌸','⭐','🌈','🎮',
  '⚽','🎨','🚀','🦸','🧸','🎪','🏆','🐲',
];

type Step = 1 | 2 | 3;

interface AddedMember { id: number; name: string; avatar_emoji: string }

export default function SetupScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'taken' | 'ok'>('idle');

  // Step 2 fields
  const [createdFamily, setCreatedFamily] = useState<Family | null>(null);
  const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberEmoji, setMemberEmoji] = useState('🦁');
  const [addingMember, setAddingMember] = useState(false);

  // Validate code on blur
  const handleCodeBlur = async () => {
    const normalized = familyCode.trim().toLowerCase();
    if (!normalized) return;
    setCodeStatus('checking');
    try {
      await checkFamilyCode(normalized);
      setCodeStatus('taken');
    } catch {
      setCodeStatus('ok');
    }
  };

  const handleCreateFamily = async () => {
    const trimmedName = familyName.trim();
    const trimmedCode = familyCode.trim().toLowerCase();
    if (!trimmedName) { setError('יש להזין שם משפחה'); return; }
    if (!trimmedCode) { setError('יש להזין קוד משפחה'); return; }
    if (codeStatus === 'taken') { setError('הקוד תפוס, בחר קוד אחר'); return; }
    const pin = adminPin.trim() || '1234';
    setLoading(true);
    setError(null);
    try {
      const family = await createFamily({ name: trimmedName, code: trimmedCode, admin_pin: pin });
      setCreatedFamily(family);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת המשפחה');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberName.trim() || !createdFamily) return;
    setAddingMember(true);
    setError(null);
    try {
      const member = await createMember(createdFamily.code, {
        name: memberName.trim(),
        avatar_emoji: memberEmoji,
      });
      setAddedMembers((prev) => [...prev, member]);
      setMemberName('');
      setMemberEmoji('🦁');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת הילד');
    } finally {
      setAddingMember(false);
    }
  };

  const handleFinish = () => {
    if (addedMembers.length === 0) { setError('יש להוסיף לפחות ילד אחד'); return; }
    setStep(3);
  };

  const codeInputStyle = {
    borderColor:
      codeStatus === 'ok' ? '#10B981' :
      codeStatus === 'taken' ? '#EF4444' : undefined,
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🏠</div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
            {step === 1 ? 'יצירת משפחה חדשה' : step === 2 ? 'הוספת ילדים' : '🎉 הצלחנו!'}
          </h1>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 32, height: 6, borderRadius: 3,
                background: step >= s ? '#FCD34D' : 'rgba(255,255,255,0.3)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* ── Step 1: Family details ── */}
        {step === 1 && (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: 'var(--primary)' }}>
              פרטי המשפחה
            </h2>

            <label className="label">שם המשפחה</label>
            <input
              className="input"
              placeholder="לדוגמה: משפחת כהן"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              style={{ marginBottom: 14 }}
              autoFocus
            />

            <label className="label">קוד משפחה (כתובת URL)</label>
            <input
              className="input"
              placeholder="לדוגמה: cohen"
              value={familyCode}
              onChange={(e) => { setFamilyCode(e.target.value.toLowerCase()); setCodeStatus('idle'); }}
              onBlur={handleCodeBlur}
              dir="ltr"
              style={{ marginBottom: 4, textAlign: 'left', ...codeInputStyle }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {codeStatus === 'checking' && '⏳ בודק זמינות...'}
              {codeStatus === 'taken' && <span style={{ color: '#EF4444' }}>❌ הקוד תפוס</span>}
              {codeStatus === 'ok' && <span style={{ color: '#10B981' }}>✅ הקוד פנוי</span>}
              {codeStatus === 'idle' && 'אותיות אנגלית, מספרים ומקף בלבד'}
            </div>

            <label className="label">קוד PIN להורים (ברירת מחדל: 1234)</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              placeholder="4 ספרות (אופציונלי)"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              maxLength={4}
              style={{ marginBottom: 20 }}
            />

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/')}
                style={{ flex: 1 }}
              >
                ← חזור
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateFamily}
                disabled={loading || codeStatus === 'taken'}
                style={{ flex: 2 }}
              >
                {loading ? 'יוצר...' : 'הבא →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Add members ── */}
        {step === 2 && createdFamily && (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--primary)' }}>
              הוסיפו ילדים
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              הוסף לפחות ילד אחד. תוכלו להוסיף עוד אחר כך.
            </p>

            {/* Added members list */}
            {addedMembers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {addedMembers.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 28 }}>{m.avatar_emoji}</span>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>✅ נוסף</span>
                  </div>
                ))}
              </div>
            )}

            {/* Add member form */}
            <label className="label">שם הילד/ה</label>
            <input
              className="input"
              placeholder="הכנס שם..."
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              style={{ marginBottom: 12 }}
              autoFocus
            />
            <label className="label">בחר אמוג׳י</label>
            <div className="emoji-grid" style={{ marginBottom: 16 }}>
              {AVATAR_OPTIONS.map((em) => (
                <button
                  key={em}
                  className={`emoji-btn${memberEmoji === em ? ' selected' : ''}`}
                  onClick={() => setMemberEmoji(em)}
                  type="button"
                >
                  {em}
                </button>
              ))}
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={handleAddMember}
                disabled={!memberName.trim() || addingMember}
                style={{ flex: 2 }}
              >
                {addingMember ? '⏳' : '➕ הוסף ילד'}
              </button>
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleFinish}
              disabled={addedMembers.length === 0}
            >
              {addedMembers.length === 0 ? 'הוסף לפחות ילד אחד' : `✅ סיום — ${addedMembers.length} ילדים`}
            </button>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 3 && createdFamily && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: 'var(--primary)' }}>
              המשפחה מוכנה!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              שמרו את הקישורים לכל ילד — הם יאפשרו כניסה ישירה לפרופיל האישי
            </p>

            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', fontSize: 13, color: 'var(--text-muted)' }}>
              {window.location.origin}/{createdFamily.code}
            </div>

            {addedMembers.map((m) => (
              <div key={m.id} className="card" style={{ marginBottom: 10, padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{m.avatar_emoji} {m.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', direction: 'ltr', textAlign: 'left' }}>
                  {window.location.origin}/{createdFamily.code}?member={m.id}
                </div>
              </div>
            ))}

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16, fontSize: 17 }}
              onClick={() => navigate(`/${createdFamily.code}`)}
            >
              🚀 כניסה לאפליקציה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
