import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

// Routes where the active member should be carried as ?member=ID
const MEMBER_SENSITIVE = new Set(['', 'log', 'history', 'achievements']);

export default function BottomNav() {
  const location = useLocation();
  const { familyCode, activeMemberId: contextMemberId } = useApp();

  if (!familyCode) return null;

  const base = `/${familyCode}`;

  const BASE_TABS = [
    { path: '',             icon: '🏠', label: 'בית',       endMatch: true  },
    { path: 'log',          icon: '✅', label: 'תיעוד',     endMatch: false },
    { path: 'history',      icon: '📜', label: 'היסטוריה', endMatch: false },
    { path: 'achievements', icon: '🏆', label: 'הישגים',   endMatch: false },
    { path: 'admin',        icon: '⚙️', label: 'הגדרות',   endMatch: false },
  ];

  // PRIMARY: read ?member from the current page URL — available immediately on every render,
  // no async timing dependency.
  // FALLBACK: context — covers cases like /admin where the URL has no member param.
  const urlMemberId = new URLSearchParams(location.search).get('member');
  const activeMemberId = urlMemberId
    ? parseInt(urlMemberId, 10)
    : contextMemberId;

  const tabs = BASE_TABS.map((tab) => {
    const to = tab.path ? `${base}/${tab.path}` : base;
    const withMember = activeMemberId && MEMBER_SENSITIVE.has(tab.path)
      ? `${to}?member=${activeMemberId}`
      : to;
    return { ...tab, to: withMember };
  });

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.to}
          end={tab.endMatch}
          className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="nav-tab-icon">{tab.icon}</span>
          <span className="nav-tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
