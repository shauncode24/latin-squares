import { Icon } from './icons';

export default function NavTabs({ activeTab, onChange }) {
  return (
    <div className="nav-tabs-wrapper">
      <nav className="nav-tabs" aria-label="Main Navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'normal'}
          className={`nav-tab${activeTab === 'normal' ? ' active' : ''}`}
          onClick={() => onChange('normal')}
        >
          <Icon.Grid />
          <span>Normal Practice</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'practice-mode'}
          className={`nav-tab${activeTab === 'practice-mode' ? ' active' : ''}`}
          onClick={() => onChange('practice-mode')}
        >
          <Icon.Timer />
          <span>Practice Mode</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stats'}
          className={`nav-tab${activeTab === 'stats' ? ' active' : ''}`}
          onClick={() => onChange('stats')}
        >
          <Icon.Chart />
          <span>Stats</span>
        </button>
      </nav>
    </div>
  );
}