import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { AuthModal } from './components/AuthModal';
import { PhaserCanvas } from './components/PhaserCanvas';
import { ShamanBar } from './components/ShamanBar';
import { SidePanel } from './components/SidePanel';
import { TopBar } from './components/TopBar';
import { SpatialAudioEngine } from './game/audio';
import type { GameScene, GameUiCallbacks } from './game/GameScene';
import type {
  ChatEntry,
  EmoteType,
  LeaderboardEntry,
  ServerMessage,
  ShamanItemType,
  User,
} from './types/game';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [mapName, setMapName] = useState('Sunlit Meadow');
  const [roundEndsAt, setRoundEndsAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(75);
  const [shaman, setShaman] = useState<string | null>(null);
  const [isShaman, setIsShaman] = useState(false);
  const [selectedShamanItem, setSelectedShamanItem] = useState<ShamanItemType>('plank');
  const [shamanAngleDeg, setShamanAngleDeg] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const audioRef = useRef<SpatialAudioEngine>(new SpatialAudioEngine());
  const sceneRef = useRef<GameScene | null>(null);
  const nextChatIdRef = useRef(1);
  const callbacksRef = useRef<GameUiCallbacks>({});
  const pendingMsgsRef = useRef<ServerMessage[]>([]);

  const appendChat = useCallback((author: string, text: string, isSystem: boolean) => {
    const id = nextChatIdRef.current++;
    setChatMessages((prev) => [...prev.slice(-59), { id, author, text, isSystem }]);
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) return;
      const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] };
      setLeaderboard(data.leaderboard || []);
    } catch {
      // Ignore transient network errors
    }
  }, []);

  callbacksRef.current = {
    onRoundStart: ({ map, shaman: sh, roundEndsAt: endsAt, isShaman: isS }) => {
      setMapName(map.name);
      setShaman(sh);
      setIsShaman(isS);
      setRoundEndsAt(endsAt);
      void refreshLeaderboard();
    },
    onRoundTimerUpdate: (endsAt) => setRoundEndsAt(endsAt),
    onShamanChanged: (sh, isS) => {
      setShaman(sh);
      setIsShaman(isS);
    },
    onShamanToolChanged: (itemType) => setSelectedShamanItem(itemType),
    onShamanAngleChanged: (deg) => setShamanAngleDeg(deg),
    onOnlineCountChanged: (count) => setOnlineCount(count),
    onStatsUpdated: ({ carrotsCollected, firstPlaces }) => {
      setUser((prev) => (prev ? { ...prev, carrotsCollected, firstPlaces } : prev));
      void refreshLeaderboard();
    },
    onChatMessage: (username, text) => appendChat(username, text, false),
    onSystemChat: (text) => appendChat('', text, true),
  };

  // Bootstrap persistent session via /api/me
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok && active) {
          const data = (await res.json()) as { user?: User };
          if (data.user) {
            setUser(data.user);
            void refreshLeaderboard();
          }
        }
      } catch {
        // Stay logged out
      } finally {
        if (active) setAuthChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshLeaderboard]);

  // Round countdown timer
  useEffect(() => {
    if (!roundEndsAt) return;
    const id = window.setInterval(() => {
      const secs = Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
      setSecondsLeft(secs);
    }, 250);
    return () => window.clearInterval(id);
  }, [roundEndsAt]);

  // Manage authenticated WebSocket lifecycle
  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        prev?.close();
        return null;
      });
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let activeWs: WebSocket | null = null;

    const connect = () => {
      if (cancelled) return;
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProto}//${window.location.host}/ws`);
      activeWs = ws;
      setSocket(ws);

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          if (sceneRef.current) {
            sceneRef.current.handleServerMessage(msg);
          } else {
            // Scene not ready yet — buffer the message so it isn't lost
            pendingMsgsRef.current.push(msg);
          }
        } catch {
          // Ignore malformed payloads
        }
      });

      ws.addEventListener('close', (event) => {
        if (!cancelled && event.code !== 4001) {
          appendChat('', 'Connection lost — reconnecting...', true);
          reconnectTimer = window.setTimeout(connect, 2000);
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      activeWs?.close();
      setSocket(null);
    };
  }, [user, appendChat]);

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    audioRef.current.setEnabled(next);
    if (next) audioRef.current.unlock();
    setAudioEnabled(next);
  };

  const handleLogout = async () => {
    await fetch('/logout', { method: 'POST' });
    setUser(null);
    setChatMessages([]);
    setShowAuthModal(true);
  };

  const handleSceneReady = useCallback((scene: GameScene | null) => {
  sceneRef.current = scene;

  if (scene) {
    for (const msg of pendingMsgsRef.current) {
      scene.handleServerMessage(msg);
    }

    pendingMsgsRef.current = [];
  }
}, []);

  const handleEmote = (emote: EmoteType) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'emote', emote }));
    }
  };

  const handleSendChat = (text: string) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'chat', text }));
    }
  };

  return (
    <div id="app">
      <TopBar
        user={user}
        mapName={mapName}
        secondsLeft={secondsLeft}
        shaman={shaman}
        isShaman={isShaman}
        onlineCount={onlineCount}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      <main className="stage-wrap">
        <PhaserCanvas
          socket={socket}
          audio={audioRef.current}
          callbacksRef={callbacksRef}
          onSceneReady={handleSceneReady}
        />

        {user && isShaman && (
          <ShamanBar
            selectedItem={selectedShamanItem}
            angleDeg={shamanAngleDeg}
            onSelectItem={(item) => sceneRef.current?.setShamanItem(item)}
            onRotate={(deg) => sceneRef.current?.rotateShamanItem(deg)}
          />
        )}

        {user && <ActionBar onEmote={handleEmote} />}

        {user && (
          <SidePanel
            chatMessages={chatMessages}
            leaderboard={leaderboard}
            onSendChat={handleSendChat}
            onRefreshLeaderboard={refreshLeaderboard}
          />
        )}

        {authChecked && (!user || showAuthModal) && (
          <AuthModal
            onUnlockAudio={() => audioRef.current.unlock()}
            onSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setShowAuthModal(false);
              void refreshLeaderboard();
            }}
          />
        )}
      </main>
    </div>
  );
}
