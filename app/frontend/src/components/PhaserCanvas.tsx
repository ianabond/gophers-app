
import { useEffect, useRef, type MutableRefObject } from 'react';
import Phaser from 'phaser';
import type { SpatialAudioEngine } from '../game/audio';
import {
  GameScene,
  type GameUiCallbacks,
} from '../game/GameScene';

interface PhaserCanvasProps {
  username: string;
  furColor: string;
  audio: SpatialAudioEngine;
  callbacksRef: MutableRefObject<GameUiCallbacks>;
  onSceneReady: (scene: GameScene | null) => void;
}

export function PhaserCanvas({
  username,
  furColor,
  audio,
  callbacksRef,
  onSceneReady,
}: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GameScene();

    const proxyCallbacks: GameUiCallbacks = {
      onRoundStart: (p) =>
        callbacksRef.current.onRoundStart?.(p),

      onRoundTimerUpdate: (t) =>
        callbacksRef.current.onRoundTimerUpdate?.(t),

      onShamanChanged: (s, isS) =>
        callbacksRef.current.onShamanChanged?.(s, isS),

      onShamanToolChanged: (i) =>
        callbacksRef.current.onShamanToolChanged?.(i),

      onShamanAngleChanged: (deg) =>
        callbacksRef.current.onShamanAngleChanged?.(deg),

      onOnlineCountChanged: (c) =>
        callbacksRef.current.onOnlineCountChanged?.(c),

      onRoomUpdated: (room) =>
        callbacksRef.current.onRoomUpdated?.(room),

      onSelfUsernameAssigned: (u) =>
        callbacksRef.current.onSelfUsernameAssigned?.(u),

      onConnectionStatusChanged: (st) =>
        callbacksRef.current.onConnectionStatusChanged?.(st),

      onStatsUpdated: (st) =>
        callbacksRef.current.onStatsUpdated?.(st),

      onChatMessage: (u, txt) =>
        callbacksRef.current.onChatMessage?.(u, txt),

      onSystemChat: (txt) =>
        callbacksRef.current.onSystemChat?.(txt),
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1280,
      height: 720,
      backgroundColor: '#7fd3f7',

      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },

      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 1.15 },
          debug: false,
        },
      },

      scene: [],
    });

    game.scene.add('GameScene', scene, true, {
      audio,
      uiCallbacks: proxyCallbacks,
      username,
      furColor,
    });

    onSceneReady(scene);

    return () => {
      onSceneReady(null);
      scene.closeSocket();
      game.destroy(true);
    };
  }, [username, furColor, audio, callbacksRef, onSceneReady]);

  return (
    <div
      ref={containerRef}
      id="game-container"
      className="game-container"
    />
  );
}
