import type { ItemCounts, ShamanItemType } from '../types/game';

interface ShamanBarProps {
  selectedItem: ShamanItemType;
  itemCounts: ItemCounts;
  angleDeg: number;
  onSelectItem: (item: ShamanItemType) => void;
  onRotate: (degDelta: number) => void;
}

const ITEMS: Array<{ id: ShamanItemType; label: string }> = [
  { id: 'plank', label: '[1] Plank' },
  { id: 'crate', label: '[2] Crate' },
  { id: 'mushroom', label: '[3] Mushroom' },
  { id: 'gust', label: '[4] Wind Gust' },
  { id: 'deleter', label: '[5] Deleter' },
];

export function ShamanBar({ selectedItem, itemCounts, angleDeg, onSelectItem, onRotate }: ShamanBarProps) {
  return (
    <div className="shaman-bar">
      <div className="shaman-title">🛠️ Round Items (1 of each per round · Click world to use)</div>
      <div className="shaman-items">
        {ITEMS.map((item) => {
          const remaining = itemCounts[item.id] ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={remaining <= 0}
              className={`tool-btn${selectedItem === item.id ? ' active' : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              {item.label} ({remaining})
            </button>
          );
        })}
      </div>
      <div className="shaman-rotate">
        <button type="button" className="tool-btn" onClick={() => onRotate(-15)}>
          ↺ Q
        </button>
        <span id="shaman-angle-label">{angleDeg}°</span>
        <button type="button" className="tool-btn" onClick={() => onRotate(15)}>
          E ↻
        </button>
      </div>
    </div>
  );
}
