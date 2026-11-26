import { useEffect, useRef, type MutableRefObject } from 'react';
import Phaser from 'phaser';
import type { SpatialAudioEngine } from '../game/audio';
import { GameScene, type GameUiCallbacks } from '../game/GameScene';

interface PhaserCanvasProps {
  socket: WebSocket | null;
  audio: SpatialAudioEngine;
  callbacksRef: MutableRefObject<GameUiCallbacks>;
  onSceneReady: (scene: GameScene | null) => void;
}

export function PhaserCanvas({ socket, audio, callbacksRef, onSceneReady }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GameScene | null>(null);

  useEffect(() => {
    if (!socket || !containerRef.current) {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
        onSceneReady(null);
      }
      return;
    }

    if (!gameRef.current) {
      const scene = new GameScene();
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 1280,
        height: 720,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'matter',
          matter: {
            gravity: { x: 0, y: 1.15 },
          },
        },
        scene: [],
      });

      const proxyCallbacks: GameUiCallbacks = {
        onRoundStart: (p) => callbacksRef.current.onRoundStart?.(p),
        onRoundTimerUpdate: (t) => callbacksRef.current.onRoundTimerUpdate?.(t),
        onShamanChanged: (s, isS) => callbacksRef.current.onShamanChanged?.(s, isS),
        onShamanToolChanged: (i) => callbacksRef.current.onShamanToolChanged?.(i),
        onShamanAngleChanged: (deg) => callbacksRef.current.onShamanAngleChanged?.(deg),
        onOnlineCountChanged: (c) => callbacksRef.current.onOnlineCountChanged?.(c),
        onStatsUpdated: (st) => callbacksRef.current.onStatsUpdated?.(st),
        onChatMessage: (u, txt) => callbacksRef.current.onChatMessage?.(u, txt),
        onSystemChat: (txt) => callbacksRef.current.onSystemChat?.(txt),
      };

      game.scene.add('GameScene', scene, true, {
        socket,
        audio,
        uiCallbacks: proxyCallbacks,
      });

      gameRef.current = game;
      sceneRef.current = scene;
      onSceneReady(scene);
    } else if (sceneRef.current) {
      sceneRef.current.socket = socket;
    }
  }, [socket, audio, callbacksRef, onSceneReady]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
        onSceneReady(null);
      }
    };
  }, [onSceneReady]);

  return <div ref={containerRef} id="game-container" className="game-container" />;
}
