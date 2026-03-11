import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

interface FamilyRow {
  id: number;
  name: string;
  code: string;
  created_at: string;
  member_count: number;
}

async function fetchFamilies(key: string): Promise<FamilyRow[]> {
  const res = await fetch(`${API_BASE}/superadmin/families`, {
    headers: { 'x-super-admin-key': key },
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('server error');
  return res.json();
}

async function deleteFamily(key: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/superadmin/families/${id}`, {
    method: 'DELETE',
    headers: { 'x-super-admin-key': key },
  });
  if (!res.ok) throw new Error('delete failed');
}

const SESSION_KEY = 'super_admin_key';

export default function SuperAdminScreen() {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY)
  );
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FamilyRow | null>(null);

  useEffect(() => {
    if (!savedKey) return;
    setLoading(true);
    fetchFamilies(savedKey)
      .then(setFamilies)
      .catch((e) => {
        if (e.message === 'unauthorized') {
          sessionStorage.removeItem(SESSION_KEY);
          setSavedKey(null);
          setError('מפתח שגוי');
        } else {
          setError('שגיאת שרת');
        }
      })
      .finally(() => setLoading(false));
  }, [savedKey]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    sessionStorage.setItem(SESSION_KEY, key.trim());
    setSavedKey(key.trim());
    setError('');
  }

  async function handleDelete(family: FamilyRow) {
    if (!savedKey) return;
    try {
      await deleteFamily(savedKey, family.id);
      setFamilies((prev) => prev.filter((f) => f.id !== family.id));
    } catch {
      setError('מחיקה נכשלה');
    } finally {
      setConfirmDelete(null);
    }
  }

  // Login screen
  if (!savedKey) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360, background: 'var(--card-bg)', borderRadius: 16, padding: 32, border: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ textAlign: 'center', margin: '0 0 24px', fontSize: 20 }}>Super Admin</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="מפתח גישה"
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 16, textAlign: 'right', background: 'var(--input-bg)', color: 'var(--text)' }}
              autoFocus
            />
            {error && <p style={{ color: 'var(--error)', margin: 0, textAlign: 'center', fontSize: 14 }}>{error}</p>}
            <button type="submit" style={{ padding: '12px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>
              כניסה
            </button>
          </form>
          <button onClick={() => navigate('/')} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
            ← חזרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', padding: '24px 16px', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>🔐 Super Admin</h1>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); setSavedKey(null); }}
          style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
        >
          התנתק
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>טוען...</p>}
      {error && <p style={{ textAlign: 'center', color: 'var(--error)' }}>{error}</p>}

      {/* Families list */}
      {!loading && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
            {families.length} משפחות רשומות
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {families.map((f) => (
              <div
                key={f.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{f.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                    קוד: <code style={{ background: 'var(--border)', padding: '1px 6px', borderRadius: 4 }}>{f.code}</code>
                    {' · '}
                    {f.member_count} חברים
                    {' · '}
                    {new Date(f.created_at).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => navigate(`/${f.code}`)}
                    style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    כניסה
                  </button>
                  <button
                    onClick={() => setConfirmDelete(f)}
                    style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--error, #e53e3e)', color: 'var(--error, #e53e3e)', cursor: 'pointer', fontSize: 13 }}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px' }}>מחיקת משפחה</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px' }}>
              האם למחוק את <strong>{confirmDelete.name}</strong> וכל הנתונים שלה? פעולה זו בלתי הפיכה.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 15 }}>
                ביטול
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--error, #e53e3e)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
