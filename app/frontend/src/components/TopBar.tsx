import type { User } from '../types/game';

interface TopBarProps {
  user: User | null;
  mapName: string;
  secondsLeft: number;
  shaman: string | null;
  isShaman: boolean;
  onlineCount: number;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export function TopBar({
  user,
  mapName,
  secondsLeft,
  shaman,
  isShaman,
  onlineCount,
  audioEnabled,
  onToggleAudio,
  onLogout,
  onOpenAuth,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon">🐇</span>
        <div>
          <h1>BunnyBurrow</h1>
          <p className="subtitle">Grab the carrot · Hop to the stump nest</p>
        </div>
      </div>

      {user && (
        <div className="round-hud">
          <div className="hud-pill">
            <span className="hud-label">Map</span>
            <strong>{mapName}</strong>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Time</span>
            <strong>{secondsLeft}s</strong>
          </div>
          <div className={`hud-pill shaman-pill${isShaman ? ' shaman-active' : ''}`}>
            <span className="hud-label">Forest Shaman</span>
            <strong>{shaman || '—'}</strong>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Online</span>
            <strong>{onlineCount}</strong>
          </div>
        </div>
      )}

      <div className="user-controls">
        <button
          type="button"
          className="btn btn-ghost"
          title="Toggle Spatial Audio"
          onClick={onToggleAudio}
        >
          {audioEnabled ? '🔊 Audio On' : '🔇 Muted'}
        </button>

        {user ? (
          <div className="user-badge">
            <span className="swatch" style={{ backgroundColor: user.furColor || '#f8efe4' }} />
            <div className="user-meta">
              <strong>@{user.username}</strong>
              <span>
                {user.carrotsCollected} 🥕 · {user.firstPlaces} 🏆
              </span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onOpenAuth}>
            Login / Register
          </button>
        )}
      </div>
    </header>
  );
}
