import { useState } from 'react';

const colors = [
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
  const [furColor, setFurColor] = useState(colors[0]);

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
            bounce across mushrooms, and find your way home.
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
            {colors.map((color) => (
              <button
                key={color}
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
            onClick={() => alert(`Welcome, ${username}!`)}
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
