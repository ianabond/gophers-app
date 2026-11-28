
import { useCallback, useEffect, useRef, useState } from 'react';
import { PhaserCanvas } from './components/PhaserCanvas';
import { ShamanBar } from './components/ShamanBar';
import { SpatialAudioEngine } from './game/audio';
import type { GameScene, GameUiCallbacks } from './game/GameScene';
import type { ConnectionStatus } from './network/socket';
import type { ItemCounts, ShamanItemType } from './types/game';

const COLORS = [
  '#f8efe4',
  '#e8cbb1',
  '#d6d2d2',
  '#5b514d',
  '#f7d6e0',
  '#d8e8d4',
  '#d6e5f3',
  '#f5dfa6',
];

export function App() {
  const [username, setUsername] = useState('');
  const [displayUsername, setDisplayUsername] = useState('');
  const [furColor, setFurColor] = useState(COLORS[0]);
  const [playing, setPlaying] = useState(false);

  const [mapName, setMapName] = useState('Connecting...');
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'intermission'>('waiting');
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [roomName, setRoomName] = useState('Joining room...');
  const [roomPlayers, setRoomPlayers] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
  const [selectedItem, setSelectedItem] =
    useState<ShamanItemType>('plank');
  const [itemCounts, setItemCounts] = useState<ItemCounts>({
    plank: 1,
    crate: 1,
    mushroom: 1,
    gust: 1,
    deleter: 1,
  });
  const [angleDeg, setAngleDeg] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const sceneRef = useRef<GameScene | null>(null);
  const phaseEndsAtRef = useRef<number>(Date.now() + 20000);
  const audioRef = useRef<SpatialAudioEngine>(
    new SpatialAudioEngine()
  );

  const callbacksRef = useRef<GameUiCallbacks>({});

  callbacksRef.current = {
    onRoundStart: ({ phase: nextPhase, map, roundEndsAt, remainingMs }) => {
      setPhase(nextPhase);
      if (map) {
        setMapName(map.name);
      }
      const targetEndsAt =
        remainingMs !== undefined ? Date.now() + remainingMs : roundEndsAt;
      phaseEndsAtRef.current = targetEndsAt;
      setSecondsLeft(
        Math.max(0, Math.ceil((targetEndsAt - Date.now()) / 1000))
      );
    },

    onRoundTimerUpdate: (endsAt, remainingMs) => {
      const targetEndsAt =
        remainingMs !== undefined ? Date.now() + remainingMs : endsAt;
      phaseEndsAtRef.current = targetEndsAt;
      setSecondsLeft(
        Math.max(0, Math.ceil((targetEndsAt - Date.now()) / 1000))
      );
    },

    onRoomUpdated: (room) => {
      setRoomName(room.roomName);
      setRoomPlayers(room.roomPlayers);
      setMaxPlayers(room.maxPlayers);
    },

    onSelfUsernameAssigned: (assigned) => {
      setDisplayUsername(assigned);
    },

    onConnectionStatusChanged: (status) => {
      setConnectionStatus(status);
    },

    onShamanToolChanged: (item) => {
      setSelectedItem(item);
    },

    onItemCountsChanged: (counts) => {
      setItemCounts(counts);
    },

    onShamanAngleChanged: (angle) => {
      setAngleDeg(angle);
    },
  };

  useEffect(() => {
    if (!playing) return;

    const timer = window.setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.ceil((phaseEndsAtRef.current - Date.now()) / 1000))
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [playing]);

  const handleSceneReady = useCallback((scene: GameScene | null) => {
    sceneRef.current = scene;
  }, []);

  function handlePlay() {
    const cleanUsername = username.trim()
    if (!cleanUsername) return;
    setUsername(cleanUsername)
    setDisplayUsername(cleanUsername)
    audioRef.current.unlock();
    setPlaying(true);
  }

  function handleToggleAudio() {
    const next = !audioEnabled;
    audioRef.current.setEnabled(next);

    if (next) {
      audioRef.current.unlock();
    }

    setAudioEnabled(next);
  }

  if (!playing) {
    return (
      <main className="home">
        <header className="header">
          <a href="/" className="logo" aria-label="Bunny Burrow home">
            🐰 Bunny Burrow
          </a>
          <span>A little adventure awaits...</span>
      </header>

        <section className="hero">
          <div className="intro">
            <p className="eyebrow">WELCOME TO THE MEADOW</p>

            <h1>
              Hop into a world
              <br />
              <span>of adventure!</span>
            </h1>

            <p className="description">
              Collect golden carrots, explore magical forests,
              bounce across mushrooms, and find your way
              home to the burrow.
            </p>

            <div className="preview">
              <div
                className="bunny"
                style={{ backgroundColor: furColor }}
              >
                🐰
              </div>

              <div>
                <strong>Meet your bunny!</strong>
                <p>Your adventure starts here.</p>
              </div>
            </div>
          </div>

          <div className="create-card">
            <h2>🌼 Create Your Bunny</h2>

            <label htmlFor="username">Bunny name</label>
            <input
              id="username"
              placeholder="Enter username"
              value={username}
              maxLength={20}
              required
              onChange={(e) => setUsername(e.target.value)}
            />

            <label>Choose fur color</label>

            <div className="colors">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select ${color}`}
                  className={furColor === color ? 'selected' : ''}
                  style={{ backgroundColor: color }}
                  onClick={() => setFurColor(color)}
                />
              ))}
            </div>

            <button
              className="play"
              disabled={!username.trim()}
              onClick={handlePlay}
            >
              Let's Play! →
            </button>

            <p className="footer-note">
              No pressure, just carrots and adventures. 🥕
            </p>
          </div>
        </section>

        <section className="features">
          <div>🥕 <strong>Collect carrots</strong></div>
          <div>🍄 <strong>Explore the world</strong></div>
          <div>🏡 <strong>Find your burrow</strong></div>
        </section>
      </main>
    );
  }

  return (
    <main className="game-screen">
      <header className="game-header">
        <div>
          <a href="/" className="game-brand" aria-label="Bunny Burrow home">
          🐰 <strong>Bunny Burrow</strong>
          </a>
        </div>

        <div className="game-hud">
          <span>
            🏠 {roomName} ({roomPlayers}/{maxPlayers})
          </span>
          {phase === 'waiting' ? (
            <span>⏳ Waiting for players ({secondsLeft}s)</span>
          ) : (
            <>
              <span>🌿 {mapName}</span>
              <span>⏱ {secondsLeft}s</span>
            </>
          )}
          <span>
            <i style={{ backgroundColor: furColor }} />
            {displayUsername || username}
          </span>
          {connectionStatus !== 'connected' && (
            <span>🔌 {connectionStatus}</span>
          )}
        </div>

        <button
          className="game-audio"
          onClick={handleToggleAudio}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>
      </header>

      <section className="stage-wrap">
        <PhaserCanvas
          username={username}
          furColor={furColor}
          audio={audioRef.current}
          callbacksRef={callbacksRef}
          onSceneReady={handleSceneReady}
        />

        {phase === 'playing' && (
          <ShamanBar
            selectedItem={selectedItem}
            itemCounts={itemCounts}
            angleDeg={angleDeg}
            onSelectItem={(item) =>
              sceneRef.current?.setShamanItem(item)
            }
            onRotate={(deg) =>
              sceneRef.current?.rotateShamanItem(deg)
            }
          />
        )}
      </section>

      <footer className="game-controls">
        <span><kbd>A</kbd> <kbd>D</kbd> Move</span>
        <span><kbd>W</kbd> / <kbd>Space</kbd> Jump</span>
        <span><kbd>F</kbd> Boop</span>
        <span><kbd>1-5</kbd> Select item</span>
        <span><kbd>Q</kbd> / <kbd>E</kbd> Rotate</span>
        <span>Click to use item</span>
      </footer>
    </main>
  );
}
