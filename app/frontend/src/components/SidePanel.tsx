import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatEntry, LeaderboardEntry } from '../types/game';

interface SidePanelProps {
  chatMessages: ChatEntry[];
  leaderboard: LeaderboardEntry[];
  onSendChat: (text: string) => void;
  onRefreshLeaderboard: () => void;
}

export function SidePanel({
  chatMessages,
  leaderboard,
  onSendChat,
  onRefreshLeaderboard,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'leaders'>('chat');
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setDraft('');
    inputRef.current?.blur();
  };

  return (
    <aside className="side-panel">
      <div className="panel-tabs">
        <button
          type="button"
          className={`tab-btn${activeTab === 'chat' ? ' active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Burrow Chat
        </button>
        <button
          type="button"
          className={`tab-btn${activeTab === 'leaders' ? ' active' : ''}`}
          onClick={() => {
            setActiveTab('leaders');
            onRefreshLeaderboard();
          }}
        >
          Leaderboard
        </button>
      </div>

      <div className={`tab-content${activeTab === 'chat' ? ' active' : ''}`}>
        <div ref={logRef} className="chat-log">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={msg.isSystem ? 'chat-entry system' : 'chat-entry'}>
              {msg.isSystem ? (
                msg.text
              ) : (
                <>
                  <strong>{msg.author}: </strong>
                  <span>{msg.text}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            maxLength={140}
            placeholder="Squeak something..."
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Send
          </button>
        </form>
      </div>

      <div className={`tab-content${activeTab === 'leaders' ? ' active' : ''}`}>
        <ol className="leaderboard-list">
          {leaderboard.map((row) => (
            <li key={row.username}>
              {row.username} — {row.carrotsCollected} 🥕 · {row.firstPlaces} 🏆 ·{' '}
              {row.shamanSaves} ✨
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
