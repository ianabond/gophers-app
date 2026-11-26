import { useState, type FormEvent } from 'react';
import { FUR_COLORS, type User } from '../types/game';

interface AuthModalProps {
  onSuccess: (user: User) => void;
  onUnlockAudio: () => void;
}

export function AuthModal({ onSuccess, onUnlockAudio }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [furColor, setFurColor] = useState<string>(FUR_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onUnlockAudio();
    setError(null);
    setSubmitting(true);

    const endpoint = mode === 'register' ? '/register' : '/login';
    const payload: Record<string, string> = {
      username: username.trim(),
      password,
    };
    if (mode === 'register') {
      payload.furColor = furColor;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { user?: User; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || 'Authentication failed');
        return;
      }
      setPassword('');
      onSuccess(data.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-hero">
          <span className="hero-bunny">🐰🥕🪵</span>
          <h2>Welcome to BunnyBurrow</h2>
          <p>
            Team up in real time! Hop across platforms, summon planks &amp; bouncy mushrooms as
            the Forest Shaman, snag the Golden Carrot, and dash back to the Tree Stump Nest.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Create Bunny
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Bunny Username</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              placeholder="cotton_tail"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              maxLength={128}
              placeholder="••••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {mode === 'register' && (
            <div className="fur-picker-wrap">
              <span>Choose Fur Color</span>
              <div className="fur-picker">
                {FUR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`fur-option${furColor === color ? ' selected' : ''}`}
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => setFurColor(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={submitting} className="btn btn-primary btn-full">
            {submitting ? 'Hopping in...' : mode === 'register' ? 'Create Bunny & Play!' : 'Hop In!'}
          </button>
        </form>
      </div>
    </div>
  );
}
