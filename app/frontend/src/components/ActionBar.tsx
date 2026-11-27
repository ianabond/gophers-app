import type { EmoteType } from '../types/game';

interface ActionBarProps {
  onEmote: (emote: EmoteType) => void;
}

const EMOTES: Array<{ id: EmoteType; icon: string; title: string }> = [
  { id: 'carrot', icon: '🥕', title: 'Carrot!' },
  { id: 'heart', icon: '❤️', title: 'Love!' },
  { id: 'sparkle', icon: '✨', title: 'Magic!' },
  { id: 'boop', icon: '💨', title: 'Boop!' },
  { id: 'gg', icon: '🏆', title: 'GG!' },
];

export function ActionBar({ onEmote }: ActionBarProps) {
  return (
    <div className="action-bar">
      <div className="controls-hint">
        <span>
          <kbd>A</kbd>
          <kbd>D</kbd> Move
        </span>
        <span>
          <kbd>W</kbd>/<kbd>Space</kbd> Jump &amp; Wall-Jump
        </span>
        <span>
          <kbd>F</kbd> Hop-Boop!
        </span>
      </div>
      <div className="emote-strip">
        {EMOTES.map((em) => (
          <button
            key={em.id}
            type="button"
            className="emote-btn"
            title={em.title}
            onClick={() => onEmote(em.id)}
          >
            {em.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
