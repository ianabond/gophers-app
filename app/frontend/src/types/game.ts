export const FUR_COLORS = [
  '#f8efe4',
  '#e8cbb1',
  '#d6d2d2',
  '#5b514d',
  '#f7d6e0',
  '#d8e8d4',
  '#d6e5f3',
  '#f5dfa6',
] as const;

export type PlatformMaterial = 'grass' | 'wood' | 'ice' | 'stone' | 'bouncy';
export type ThemeName = 'meadow' | 'frost' | 'cavern' | 'twilight';
export type ShamanItemType = 'plank' | 'crate' | 'mushroom' | 'gust' | 'deleter';
export type EmoteType = 'carrot' | 'heart' | 'sparkle' | 'boop' | 'gg';
export type AnimState = 'idle' | 'run' | 'jump' | 'fall' | 'wall';

export interface User {
  id: number;
  username: string;
  furColor: string;
  carrotsCollected: number;
  firstPlaces: number;
  shamanSaves: number;
}

export interface LeaderboardEntry {
  username: string;
  furColor: string;
  carrotsCollected: number;
  firstPlaces: number;
  shamanSaves: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlatformData {
  x: number;
  y: number;
  w: number;
  h: number;
  material: PlatformMaterial;
  angle: number;
}

export interface MapData {
  id: string;
  name: string;
  theme: ThemeName;
  roundDurationSec: number;
  spawn: Point;
  carrot: Point;
  stump: Point;
  platforms: PlatformData[];
}

export interface PlayerSnapshot {
  username: string;
  furColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: AnimState;
  hasCarrot: boolean;
  finished: boolean;
  place: number | null;
  carrotsCollected: number;
  firstPlaces: number;
  shamanSaves: number;
}

export interface ShamanObject {
  id: string;
  type: ShamanItemType;
  x: number;
  y: number;
  angle: number;
}

export interface CrateSnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
}

export interface ChatEntry {
  id: number;
  author: string;
  text: string;
  isSystem: boolean;
}

export interface Impulse {
  username: string;
  vx: number;
  vy: number;
}

export interface RoomInfo {
  roomId: string;
  roomName: string;
  roomPlayers: number;
  maxPlayers: number;
}

export type ClientMessage =
  | {
      type: 'state';
      x: number;
      y: number;
      vx: number;
      vy: number;
      facing: 1 | -1;
      anim: AnimState;
    }
  | { type: 'carrot_pickup' }
  | { type: 'stump_reach' }
  | { type: 'respawn_request' }
  | { type: 'boop' }
  | {
      type: 'shaman_spawn';
      itemType: Exclude<ShamanItemType, 'deleter'>;
      x: number;
      y: number;
      angle: number;
    }
  | { type: 'shaman_remove'; objectId: string }
  | {
      type: 'shaman_preview';
      itemType: ShamanItemType;
      x: number;
      y: number;
      angle: number;
    }
  | { type: 'emote'; emote: EmoteType };

export type ServerMessage =
  | {
      type: 'welcome';
      selfUsername: string;
      roomId: string;
      roomName: string;
      roomPlayers: number;
      maxPlayers: number;
      roundNumber: number;
      phase: 'waiting' | 'playing' | 'intermission';
      map: MapData;
      shaman: string | null;
      roundEndsAt: number;
      objects: ShamanObject[];
      players: PlayerSnapshot[];
    }
  | {
      type: 'waiting_start';
      roundNumber: number;
      map: MapData;
      roundEndsAt: number;
      players?: PlayerSnapshot[];
      roomId?: string;
      roomName?: string;
      roomPlayers?: number;
      maxPlayers?: number;
    }
  | {
      type: 'round_start';
      roundNumber: number;
      map: MapData;
      shaman: string | null;
      roundEndsAt: number;
      players?: PlayerSnapshot[];
    }
  | { type: 'round_ended'; roundNumber: number; nextRoundAt: number }
  | { type: 'round_ending_soon'; roundEndsAt: number }
  | {
      type: 'player_joined';
      player: PlayerSnapshot;
      shaman: string | null;
      roomId?: string;
      roomName?: string;
      roomPlayers?: number;
      maxPlayers?: number;
    }
  | {
      type: 'player_left';
      username: string;
      shaman: string | null;
      roomId?: string;
      roomName?: string;
      roomPlayers?: number;
      maxPlayers?: number;
    }
  | { type: 'snapshot'; players: PlayerSnapshot[]; crates?: CrateSnapshot[]; serverTime: number }
  | { type: 'carrot_picked'; username: string; x: number; y: number }
  | {
      type: 'bunny_nested';
      username: string;
      place: number;
      x: number;
      y: number;
      shamanUsername: string | null;
      carrotsCollected: number;
      firstPlaces: number;
    }
  | { type: 'respawn'; x: number; y: number; droppedCarrot: boolean }
  | {
      type: 'boop_effect';
      from: string;
      x: number;
      y: number;
      impulses: Impulse[];
    }
  | {
      type: 'player_collision';
      x: number;
      y: number;
      impulses: Impulse[];
    }
  | { type: 'object_spawned'; object: ShamanObject; shaman: string }
  | { type: 'object_removed'; id: string }
  | {
      type: 'shaman_preview';
      shaman: string;
      itemType: ShamanItemType;
      x: number;
      y: number;
      angle: number;
    }
  | { type: 'emote'; username: string; emote: EmoteType }
  | { type: 'chat'; username: string; text: string };
