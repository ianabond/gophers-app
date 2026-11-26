
import { useCallback, useRef, useState } from 'react';
import { PhaserCanvas } from './components/PhaserCanvas';
import { ShamanBar } from './components/ShamanBar';
import { SpatialAudioEngine } from './game/audio';
import type { GameScene, GameUiCallbacks } from './game/GameScene';
import type { ShamanItemType } from './types/game';

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
  const [username, setUsername] = useState('CottonTail');
  const [furColor, setFurColor] = useState(COLORS[0]);
  const [playing, setPlaying] = useState(false);

  const [mapName, setMapName] = useState('Sunlit Meadow');
  const [secondsLeft, setSecondsLeft] = useState(75);
  const [isShaman, setIsShaman] = useState(true);
  const [selectedItem, setSelectedItem] =
    useState<ShamanItemType>('plank');
  const [angleDeg, setAngleDeg] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const sceneRef = useRef<GameScene | null>(null);
  const audioRef = useRef<SpatialAudioEngine>(
    new SpatialAudioEngine()
  );

  const callbacksRef = useRef<GameUiCallbacks>({});

  callbacksRef.current = {
    onRoundStart: ({ map, roundEndsAt, isShaman: shaman }) => {
      setMapName(map.name);
      setSecondsLeft(
        Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000))
      );
      setIsShaman(shaman);
    },

    onRoundTimerUpdate: (endsAt) => {
      setSecondsLeft(
        Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      );
    },

    onShamanChanged: (_shaman, shaman) => {
      setIsShaman(shaman);
    },

    onShamanToolChanged: (item) => {
      setSelectedItem(item);
    },

    onShamanAngleChanged: (angle) => {
      setAngleDeg(angle);
    },
  };

  const handleSceneReady = useCallback((scene: GameScene | null) => {
    sceneRef.current = scene;
  }, []);

  function handlePlay() {
    if (!username.trim()) return;

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
          <div className="logo">🐰 Bunny Burrow</div>
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
              value={username}
              maxLength={20}
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
        <div className="game-brand">
          🐰 <strong>Bunny Burrow</strong>
        </div>

        <div className="game-hud">
          <span>🌿 {mapName}</span>
          <span>⏱ {secondsLeft}s</span>
          <span>
            ✨ {isShaman ? 'You are the Shaman!' : 'Shaman'}
          </span>
          <span>
            <i style={{ backgroundColor: furColor }} />
            {username}
          </span>
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

        {isShaman && (
          <ShamanBar
            selectedItem={selectedItem}
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
        <span><kbd>1-4</kbd> Select shaman tool</span>
        <span><kbd>Q</kbd> / <kbd>E</kbd> Rotate</span>
        <span>Click to place objects</span>
      </footer>
    </main>
  );
}
