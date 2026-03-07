import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/',             icon: '🏠', label: 'בית' },
  { to: '/log',          icon: '✅', label: 'תיעוד' },
  { to: '/history',      icon: '📜', label: 'היסטוריה' },
  { to: '/achievements', icon: '🏆', label: 'הישגים' },
  { to: '/admin',        icon: '⚙️', label: 'הגדרות' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="nav-tab-icon">{tab.icon}</span>
          <span className="nav-tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
