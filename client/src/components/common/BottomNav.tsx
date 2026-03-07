import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const BASE_TABS = [
  { to: '/',             icon: '🏠', label: 'בית',       endMatch: true  },
  { to: '/log',          icon: '✅', label: 'תיעוד',     endMatch: false },
  { to: '/history',      icon: '📜', label: 'היסטוריה', endMatch: false },
  { to: '/achievements', icon: '🏆', label: 'הישגים',   endMatch: false },
  { to: '/admin',        icon: '⚙️', label: 'הגדרות',   endMatch: false },
];

// Routes where the active member should be carried as ?member=ID
const MEMBER_SENSITIVE = new Set(['/', '/log', '/history', '/achievements']);

export default function BottomNav() {
  const location = useLocation();
  const { activeMemberId: contextMemberId } = useApp();

  // PRIMARY: read ?member from the current page URL — available immediately on every render,
  // no async timing dependency.
  // FALLBACK: context — covers cases like /admin where the URL has no member param.
  const urlMemberId = new URLSearchParams(location.search).get('member');
  const activeMemberId = urlMemberId
    ? parseInt(urlMemberId, 10)
    : contextMemberId;

  const tabs = BASE_TABS.map((tab) => ({
    ...tab,
    to: activeMemberId && MEMBER_SENSITIVE.has(tab.to)
      ? `${tab.to}?member=${activeMemberId}`
      : tab.to,
  }));

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
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
