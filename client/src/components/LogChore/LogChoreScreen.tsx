import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { getChores, logChore } from '../../api';
import { useApp } from '../../context/AppContext';
import type { Chore, FamilyMember } from '../../types';
import { DIFFICULTY_META } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import PointsAnimation from './PointsAnimation';

type Step = 'member' | 'chore' | 'confirm';

interface AnimationData {
  memberEmoji: string;
  memberName: string;
  choreName: string;
  points: number;
  newAchievements: string[];
}

export default function LogChoreScreen() {
  const { family, familyCode } = useApp();
  const { familyCode: urlCode } = useParams<{ familyCode: string }>();
  const fc = familyCode || urlCode || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('member');
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimationData | null>(null);
  const [postAnimationUrl, setPostAnimationUrl] = useState<string | null>(null);

  const { data: chores, isLoading: choresLoading } = useQuery({
    queryKey: ['chores-active', fc],
    queryFn: () => getChores(fc, true),
    enabled: !!fc,
  });

  // True when the member was pre-selected from the URL param (personal deep-link)
  const isUrlMember = !!searchParams.get('member');

  // Auto-select member from ?member=ID URL param (deep-link support)
  useEffect(() => {
    const memberId = searchParams.get('member');
    if (memberId && family.length > 0 && step === 'member') {
      const member = family.find((m) => m.id === parseInt(memberId, 10));
      if (member) {
        setSelectedMember(member);
        setStep('chore');
      }
    }
  }, [searchParams, family]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMemberSelect = (member: FamilyMember) => {
    setSelectedMember(member);
    setStep('chore');
  };

  const handleChoreSelect = (chore: Chore) => {
    setSelectedChore(chore);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedMember || !selectedChore) return;
    setLoading(true);
    setError(null);
    try {
      const result = await logChore(fc, {
        family_member_id: selectedMember.id,
        chore_id: selectedChore.id,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['current-periods', fc] });
      queryClient.invalidateQueries({ queryKey: ['logs', fc] });
      queryClient.invalidateQueries({ queryKey: ['achievements', fc] });

      // If dog-walking chore → queue redirect to waffle-walks after animation
      const isDogWalk = selectedChore.name.includes('הוצאת הכלב');
      if (isDogWalk) {
        const nameHash = encodeURIComponent(selectedMember.name.slice(0, 3));
        setPostAnimationUrl(`https://waffle-walks.vercel.app/#${nameHash}`);
      }

      // Show animation
      setAnimation({
        memberEmoji: selectedMember.avatar_emoji,
        memberName: selectedMember.name,
        choreName: selectedChore.name,
        points: result.log.points_earned,
        newAchievements: result.newAchievements,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בתיעוד המטלה');
    } finally {
      setLoading(false);
    }
  };

  const handleAnimationDone = useCallback(() => {
    setAnimation(null);
    if (postAnimationUrl) {
      window.location.href = postAnimationUrl;
    } else {
      // Return to home with member param so dashboard stays personalised
      navigate(selectedMember ? `/${fc}?member=${selectedMember.id}` : `/${fc}`);
    }
  }, [navigate, fc, postAnimationUrl, selectedMember]);

  // Group chores by difficulty
  const choresByDifficulty = chores
    ? {
        easy:   chores.filter((c) => c.difficulty === 'easy'),
        medium: chores.filter((c) => c.difficulty === 'medium'),
        hard:   chores.filter((c) => c.difficulty === 'hard'),
      }
    : null;

  return (
    <div className="screen">
      {/* Animation overlay */}
      {animation && (
        <PointsAnimation
          memberEmoji={animation.memberEmoji}
          memberName={animation.memberName}
          choreName={animation.choreName}
          points={animation.points}
          newAchievements={animation.newAchievements}
          onDone={handleAnimationDone}
        />
      )}

      {/* ── Step: Select Member ── */}
      {step === 'member' && (
        <>
          <div style={{ marginBottom: 24 }}>
            <h1 className="page-title">✅ תיעוד מטלה</h1>
            <p className="page-sub">מי ביצע את המטלה?</p>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {family.map((m) => (
              <button
                key={m.id}
                className="member-card"
                onClick={() => handleMemberSelect(m)}
                type="button"
              >
                <span className="member-avatar">{m.avatar_emoji}</span>
                <span className="member-name">{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Step: Select Chore ── */}
      {step === 'chore' && (
        <>
          <div style={{ marginBottom: 20 }}>
            {/* Hide back-to-member-select when locked to a URL member */}
            {!isUrlMember && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setStep('member')}
                style={{ marginBottom: 12 }}
              >
                → חזור
              </button>
            )}
            <h1 className="page-title">
              {selectedMember?.avatar_emoji} {selectedMember?.name}
            </h1>
            <p className="page-sub">איזו מטלה בוצעה?</p>
          </div>

          {choresLoading && <LoadingSpinner />}

          {choresByDifficulty && (
            <div className="list-scroll">
              {(['easy', 'medium', 'hard'] as const).map((diff) => {
                const group = choresByDifficulty[diff];
                if (group.length === 0) return null;
                const meta = DIFFICULTY_META[diff];
                return (
                  <div key={diff} style={{ marginBottom: 16 }}>
                    <div className="section-title">
                      <span
                        className="chip"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label} — {group[0].points} נק׳
                      </span>
                    </div>
                    {group.map((chore) => (
                      <div
                        key={chore.id}
                        className="chore-item"
                        onClick={() => handleChoreSelect(chore)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleChoreSelect(chore)}
                      >
                        <span className="chore-item-name">{chore.name}</span>
                        <div className="chore-item-right">
                          <span className="chore-pts">+{chore.points}</span>
                          <span style={{ color: 'var(--border)', fontSize: 20 }}>›</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Step: Confirm ── */}
      {step === 'confirm' && selectedMember && selectedChore && (
        <>
          <div style={{ marginBottom: 20 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setStep('chore')}
              style={{ marginBottom: 12 }}
            >
              → חזור
            </button>
            <h1 className="page-title">אישור מטלה</h1>
          </div>

          {/* Summary card */}
          <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{selectedMember.avatar_emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{selectedMember.name}</div>

            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{selectedChore.name}</div>
              <span
                className="chip"
                style={{
                  background: DIFFICULTY_META[selectedChore.difficulty].bg,
                  color: DIFFICULTY_META[selectedChore.difficulty].color,
                }}
              >
                {DIFFICULTY_META[selectedChore.difficulty].label}
              </span>
            </div>

            <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--primary)', marginBottom: 4 }}>
              +{selectedChore.points}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>נקודות</div>
          </div>

          {error && <ErrorMessage message={error} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={handleConfirm}
              disabled={loading}
              style={{ fontSize: 18, padding: '16px' }}
            >
              {loading ? '⏳ מתעד...' : '✅ אישור — בוצעה!'}
            </button>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => {
                if (isUrlMember && selectedMember) {
                  navigate(`/${fc}?member=${selectedMember.id}`);
                } else {
                  setStep('member');
                  setSelectedMember(null);
                  setSelectedChore(null);
                }
              }}
            >
              ביטול
            </button>
          </div>
        </>
      )}
    </div>
  );
}
