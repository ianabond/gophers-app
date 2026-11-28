import Phaser from 'phaser';
import { GameSocket, type ConnectionStatus } from '../network/socket';
import type {
  AnimState,
  ItemCounts,
  MapData,
  PlayerSnapshot,
  RoomInfo,
  ServerMessage,
  ShamanItemType,
  ShamanObject,
  ThemeName,
} from '../types/game';
import type { SpatialAudioEngine } from './audio';
import { drawPlatformTexture, ensureBunnyTexture, generateAllTextures } from './textures';

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 800;


interface ThemePalette {
  skyTop: number;
  skyBottom: number;
  hillFar: number;
  hillNear: number;
  sunColor: number;
  ambientTint: number;
}

const THEMES: Record<ThemeName, ThemePalette> = {
  meadow: {
    skyTop: 0x7fd3f7,
    skyBottom: 0xdff5df,
    hillFar: 0x7ab88f,
    hillNear: 0x4f9164,
    sunColor: 0xfff0a3,
    ambientTint: 0xfff7c2,
  },
  frost: {
    skyTop: 0x5c8ab8,
    skyBottom: 0xd9eefc,
    hillFar: 0x89aec9,
    hillNear: 0x5d87a8,
    sunColor: 0xeaf8ff,
    ambientTint: 0xffffff,
  },
  cavern: {
    skyTop: 0x181f33,
    skyBottom: 0x2c4257,
    hillFar: 0x243447,
    hillNear: 0x1b2736,
    sunColor: 0x7cf0d8,
    ambientTint: 0x8efce5,
  },
  twilight: {
    skyTop: 0x2b254a,
    skyBottom: 0x7c5475,
    hillFar: 0x3b3054,
    hillNear: 0x28213c,
    sunColor: 0xffd089,
    ambientTint: 0xffd89c,
  },
};

const EMOTE_ICONS: Record<string, string> = {
  carrot: '🥕',
  heart: '❤️',
  sparkle: '✨',
  boop: '💨',
  gg: '🏆',
};

export interface GameUiCallbacks {
  onRoundStart?: (payload: {
    phase: 'waiting' | 'playing' | 'intermission';
    map: MapData;
    roundEndsAt: number;
  }) => void;
  onRoundTimerUpdate?: (endsAt: number) => void;
  onShamanToolChanged?: (itemType: ShamanItemType) => void;
  onItemCountsChanged?: (counts: ItemCounts) => void;
  onShamanAngleChanged?: (deg: number) => void;
  onOnlineCountChanged?: (count: number) => void;
  onRoomUpdated?: (room: RoomInfo) => void;
  onSelfUsernameAssigned?: (username: string) => void;
  onConnectionStatusChanged?: (status: ConnectionStatus) => void;
  onStatsUpdated?: (stats: { carrotsCollected: number; firstPlaces: number }) => void;
  onChatMessage?: (username: string, text: string) => void;
  onSystemChat?: (text: string) => void;
}

export interface GameSceneInitData {
  audio: SpatialAudioEngine;
  uiCallbacks: GameUiCallbacks;
  username: string;
  furColor: string;
}

interface BunnyVisual extends Phaser.GameObjects.Container {
  aura: Phaser.GameObjects.Arc;
  bunnySprite: Phaser.GameObjects.Image;
  carrotSprite: Phaser.GameObjects.Image;
  crown: Phaser.GameObjects.Text;
  nameTag: Phaser.GameObjects.Text;
  emoteText: Phaser.GameObjects.Text;
  username: string;
  matterBody?: MatterJS.BodyType;
  targetX: number;
  targetY: number;
  facing: 1 | -1;
  animState: AnimState;
  hasCarrot: boolean;
  finished: boolean;
}

interface ShamanObjectEntry {
  id: string;
  type: ShamanItemType;
  sprite: Phaser.GameObjects.Image | null;
  matterBody: MatterJS.BodyType | null;
  targetX: number;
  targetY: number;
  targetAngle: number;
}

type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>;

export class GameScene extends Phaser.Scene {
  private localUsername = 'CottonTail';
  private localFurColor = '#f8efe4';
  private audio: SpatialAudioEngine | null = null;
  private uiCallbacks: GameUiCallbacks | null = null;

  private selfUsername: string | null = null;
  private currentMap: MapData | null = null;
  private phase: 'waiting' | 'playing' | 'intermission' = 'waiting';

  private socket: GameSocket | null = null;
  private spawnGraceUntil = 0;
  private lastCarrotAttemptAt = 0;
  private lastStumpAttemptAt = 0;
  private lastRespawnSentAt = 0;
  private itemCounts: ItemCounts = {
    plank: 1,
    crate: 1,
    mushroom: 1,
    gust: 1,
    deleter: 1,
  };

  private remoteBunnies = new Map<string, BunnyVisual>();
  private shamanObjects = new Map<string, ShamanObjectEntry>();
  private staticBodies: MatterJS.BodyType[] = [];
  private platformDisplays: Phaser.GameObjects.Image[] = [];
  private bgElements: Phaser.GameObjects.GameObject[] = [];
  private bodyToSprite = new Map<number, Phaser.GameObjects.Image>();

  private localBunny: BunnyVisual | null = null;
  private localState = {
    hasCarrot: false,
    finished: false,
    facing: 1 as 1 | -1,
    anim: 'idle' as AnimState,
    groundContacts: 0,
    iceContacts: 0,
    leftWallContacts: 0,
    rightWallContacts: 0,
    coyoteUntil: 0,
    jumpBufferUntil: 0,
    justJumpedUntil: 0,
    lastBoopAt: 0,
    lastStateSentAt: 0,
    lastPreviewSentAt: 0,
  };

  private selectedShamanItem: ShamanItemType = 'plank';
  private shamanAngleRad = 0;
  private localGhost: Phaser.GameObjects.Image | null = null;
  private bannerText: Phaser.GameObjects.Text | null = null;
  private carrotSprite: Phaser.GameObjects.Image | null = null;
  private stumpSprite: Phaser.GameObjects.Image | null = null;
  private stumpHint: Phaser.GameObjects.Text | null = null;
  private ambientEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private leafEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    f: Phaser.Input.Keyboard.Key;
    q: Phaser.Input.Keyboard.Key;
    e: Phaser.Input.Keyboard.Key;
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    four: Phaser.Input.Keyboard.Key;
    five: Phaser.Input.Keyboard.Key;
  };

  //private pendingWelcome: WelcomeMessage | null = null;

  constructor() {
    super('GameScene');
  }

init(data: GameSceneInitData): void {
  this.audio = data.audio;
  this.uiCallbacks = data.uiCallbacks;

  this.localUsername = data.username;
  this.localFurColor = data.furColor;
}

  create(): void {
    generateAllTextures(this);

    this.matter.world.setBounds(0, -140, WORLD_WIDTH, WORLD_HEIGHT + 280, 32, true, true, false, false);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.dustEmitter = this.add
      .particles(0, 0, 'particle_dust', {
        speed: { min: 20, max: 65 },
        angle: { min: 210, max: 330 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.75, end: 0 },
        lifespan: 360,
        emitting: false,
      })
      .setDepth(15);

    this.sparkleEmitter = this.add
      .particles(0, 0, 'particle_sparkle', {
        speed: { min: 50, max: 170 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 550,
        emitting: false,
      })
      .setDepth(16);

    this.leafEmitter = this.add
      .particles(0, 0, 'particle_leaf', {
        speed: { min: 45, max: 140 },
        gravityY: 160,
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.95, end: 0 },
        lifespan: 800,
        emitting: false,
      })
      .setDepth(16);

    this.setupInputs();
    this.setupCollisions();

    this.bannerText = this.add
      .text(this.scale.width / 2, 74, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#fff8e7',
        stroke: '#251a12',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setAlpha(0);

    this.localGhost = this.add.image(0, 0, 'shaman_plank').setAlpha(0).setDepth(18);

    this.socket = new GameSocket({
      username: this.localUsername,
      furColor: this.localFurColor,
      onMessage: (msg) => this.handleServerMessage(msg),
      onStatusChange: (status) => {
        this.uiCallbacks?.onConnectionStatusChanged?.(status);
        if (status === 'disconnected') {
          this.showBanner('Disconnected from room. Refresh to rejoin.');
        }
      },
    });
    this.socket.connect();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeSocket());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.closeSocket());
  }

  public closeSocket(): void {
    this.socket?.close();
    this.socket = null;
  }


  private setupInputs(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      f: Phaser.Input.Keyboard.KeyCodes.F,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
    }) as typeof this.keys;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.audio?.unlock();
      if (this.isTypingInInput()) return;
      if (this.phase === 'playing' && !this.localState.finished) {
        this.spawnShamanItemAt(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: unknown[], _dx: number, deltaY: number) => {
      if (this.phase === 'playing' && !this.localState.finished) {
        this.rotateShamanItem(deltaY > 0 ? 15 : -15);
      }
    });
  }

  private isTypingInInput(): boolean {
    const active = document.activeElement;
    return Boolean(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA'));
  }

  public setShamanItem(itemType: ShamanItemType): void {
    this.selectedShamanItem = itemType;
    const textureMap: Partial<Record<ShamanItemType, string>> = {
      plank: 'shaman_plank',
      crate: 'shaman_crate',
      mushroom: 'mushroom_pad',
      gust: 'gust_orb',
    };

    const texture = textureMap[itemType];

    if (texture) {
      this.localGhost?.setTexture(texture).setAlpha(0.45);
    } else {
      this.localGhost?.setAlpha(0);
    }

    this.uiCallbacks?.onShamanToolChanged?.(itemType);

  }

  public rotateShamanItem(degDelta: number): void {
    this.shamanAngleRad += Phaser.Math.DegToRad(degDelta);
    const deg = Math.round(Phaser.Math.RadToDeg(this.shamanAngleRad));
    this.uiCallbacks?.onShamanAngleChanged?.(deg);
  }

  private setupCollisions(): void {
    // Recompute active sensor contacts every physics step so removing platforms
    // or teleporting never leaves stale jump/wall contact counts stuck > 0.
    this.matter.world.on('beforeupdate', () => {
      this.localState.groundContacts = 0;
      this.localState.iceContacts = 0;
      this.localState.leftWallContacts = 0;
      this.localState.rightWallContacts = 0;
    });

    this.matter.world.on('afterupdate', () => {
      const b = this.localBunny?.matterBody;
      if (this.localBunny && b) {
        this.localBunny.setPosition(b.position.x, b.position.y);
      }
    });

    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) {
        this.handleBouncePair(pair.bodyA, pair.bodyB);
        this.handleBouncePair(pair.bodyB, pair.bodyA);
      }
    });

    this.matter.world.on('collisionactive', (event: Phaser.Physics.Matter.Events.CollisionActiveEvent) => {
      for (const pair of event.pairs) {
        this.recordActiveSensorPair(pair.bodyA, pair.bodyB);
        this.recordActiveSensorPair(pair.bodyB, pair.bodyA);
      }
    });
  }

  private handleBouncePair(sensor: MatterJS.BodyType, other: MatterJS.BodyType): void {
    const bunnyBody = this.localBunny?.matterBody;
    if (!this.localBunny || !bunnyBody || other.isSensor) return;
    if (sensor.label !== 'bunny_foot' || other.label !== 'bouncy_mushroom' || this.localState.finished) {
      return;
    }

    this.matter.body.setVelocity(bunnyBody, {
      x: bunnyBody.velocity.x,
      y: -14.2,
    });
    this.localState.coyoteUntil = 0;
    this.localState.justJumpedUntil = this.time.now + 150;
    this.audio?.playBounce(this.localBunny.x, this.localBunny.y);
    this.sparkleEmitter.emitParticleAt(this.localBunny.x, this.localBunny.y + 14, 10);
    const sprite = this.bodyToSprite.get(other.id);
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        scaleX: 1.25,
        scaleY: 0.68,
        duration: 90,
        yoyo: true,
      });
    }
  }

  private recordActiveSensorPair(sensor: MatterJS.BodyType, other: MatterJS.BodyType): void {
    const bunnyBody = this.localBunny?.matterBody;
    if (!this.localBunny || !bunnyBody || other.isSensor) return;

    if (sensor.label === 'bunny_foot') {
      this.localState.groundContacts++;
      if (other.label === 'ice_platform') {
        this.localState.iceContacts++;
      }
    } else if (other.label !== 'remote_bunny') {
      if (sensor.label === 'bunny_wall_l') {
        this.localState.leftWallContacts++;
      } else if (sensor.label === 'bunny_wall_r') {
        this.localState.rightWallContacts++;
      }
    }
  }

  public handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.applyWelcome(msg);
        break;
      case 'waiting_start':
        this.applyWaitingStart(msg);
        break;
      case 'round_start':
        this.applyRoundStart(msg);
        break;
      case 'round_ended':
        this.phase = 'intermission';
        this.uiCallbacks?.onRoundStart?.({
          phase: 'intermission',
          map: this.currentMap!,
          roundEndsAt: msg.nextRoundAt,
        });
        this.showBanner('Round Complete! Next meadow loading...');
        break;
      case 'round_ending_soon':
        this.uiCallbacks?.onRoundTimerUpdate?.(msg.roundEndsAt);
        break;
      case 'player_joined':
        if (msg.player.username !== this.selfUsername) {
          this.spawnOrUpdateRemoteBunny(msg.player);
        }
        if (msg.roomName && msg.roomPlayers !== undefined && msg.maxPlayers !== undefined) {
          this.uiCallbacks?.onRoomUpdated?.({
            roomId: msg.roomId || '',
            roomName: msg.roomName,
            roomPlayers: msg.roomPlayers,
            maxPlayers: msg.maxPlayers,
          });
        }
        this.uiCallbacks?.onOnlineCountChanged?.(this.remoteBunnies.size + (this.localBunny ? 1 : 0));
        this.uiCallbacks?.onSystemChat?.(`${msg.player.username} hopped into the meadow!`);
        break;
      case 'player_left':
        this.removeRemoteBunny(msg.username);
        if (msg.roomName && msg.roomPlayers !== undefined && msg.maxPlayers !== undefined) {
          this.uiCallbacks?.onRoomUpdated?.({
            roomId: msg.roomId || '',
            roomName: msg.roomName,
            roomPlayers: msg.roomPlayers,
            maxPlayers: msg.maxPlayers,
          });
        }
        this.uiCallbacks?.onOnlineCountChanged?.(this.remoteBunnies.size + (this.localBunny ? 1 : 0));
        this.uiCallbacks?.onSystemChat?.(`${msg.username} hopped away.`);
        break;
      case 'snapshot':
        this.applySnapshot(msg);
        break;
      case 'carrot_picked':
        this.onCarrotPicked(msg);
        break;
      case 'bunny_nested':
        this.onBunnyNested(msg);
        break;
      case 'respawn':
        this.onLocalRespawn(msg);
        break;
      case 'boop_effect':
        this.onBoopEffect(msg);
        break;
      case 'player_collision':
        this.onPlayerCollision(msg);
        break;
      case 'object_spawned':
        this.spawnShamanObject(msg.object, true);
        break;
      case 'object_removed':
        this.removeShamanObject(msg.id);
        break;
      case 'inventory_update':
        this.setItemCounts(msg.items);
        break;
      case 'emote':
        this.showBunnyEmote(msg.username, msg.emote);
        break;
      case 'chat':
        this.uiCallbacks?.onChatMessage?.(msg.username, msg.text);
        break;
    }
  }

  private resetContactState(): void {
    this.localState.groundContacts = 0;
    this.localState.iceContacts = 0;
    this.localState.leftWallContacts = 0;
    this.localState.rightWallContacts = 0;
    this.localState.coyoteUntil = 0;
    this.localState.jumpBufferUntil = 0;
    this.localState.justJumpedUntil = 0;
  }

  private setItemCounts(items?: Partial<ItemCounts>): void {
    this.itemCounts = {
      plank: items?.plank ?? 1,
      crate: items?.crate ?? 1,
      mushroom: items?.mushroom ?? 1,
      gust: items?.gust ?? 1,
      deleter: items?.deleter ?? 1,
    };
    this.uiCallbacks?.onItemCountsChanged?.({ ...this.itemCounts });
  }

  private applyWelcome(msg: WelcomeMessage): void {
    this.selfUsername = msg.selfUsername;
    this.phase = msg.phase;
    this.lastCarrotAttemptAt = 0;
    this.lastStumpAttemptAt = 0;
    this.spawnGraceUntil = Date.now() + 1200;
    this.resetContactState();

    this.uiCallbacks?.onSelfUsernameAssigned?.(msg.selfUsername);
    this.uiCallbacks?.onRoomUpdated?.({
      roomId: msg.roomId,
      roomName: msg.roomName,
      roomPlayers: msg.roomPlayers,
      maxPlayers: msg.maxPlayers,
    });

    const selfSnapshot = msg.players.find((p) => p.username === this.selfUsername);
    this.setItemCounts(selfSnapshot?.items);

    this.loadMap(msg.map);
    this.uiCallbacks?.onRoundStart?.({
      phase: msg.phase,
      map: msg.map,
      roundEndsAt: msg.roundEndsAt,
    });

    if (this.localBunny) {
      this.destroyBunnyVisual(this.localBunny);
      this.localBunny = null;
    }
    for (const rb of this.remoteBunnies.values()) {
      this.destroyBunnyVisual(rb);
    }
    this.remoteBunnies.clear();

    for (const p of msg.players) {
      if (p.username === this.selfUsername) {
        this.createLocalBunny(p);
      } else {
        this.spawnOrUpdateRemoteBunny(p);
      }
    }

    for (const obj of msg.objects || []) {
      this.spawnShamanObject(obj, false);
    }

    this.uiCallbacks?.onOnlineCountChanged?.(msg.players.length);
    if (msg.phase === 'waiting') {
      this.showBanner(`${msg.roomName} · Waiting for players...`);
    } else {
      this.showBanner(`${msg.roomName} · ${msg.map.name}`);
    }
  }

  private applyWaitingStart(msg: Extract<ServerMessage, { type: 'waiting_start' }>): void {
    this.phase = 'waiting';
    this.lastCarrotAttemptAt = 0;
    this.lastStumpAttemptAt = 0;
    this.spawnGraceUntil = Date.now() + 1200;
    this.resetContactState();

    if (msg.roomName && msg.roomPlayers !== undefined && msg.maxPlayers !== undefined) {
      this.uiCallbacks?.onRoomUpdated?.({
        roomId: msg.roomId || '',
        roomName: msg.roomName,
        roomPlayers: msg.roomPlayers,
        maxPlayers: msg.maxPlayers,
      });
    }

    this.setItemCounts();
    this.loadMap(msg.map);
    this.uiCallbacks?.onRoundStart?.({
      phase: 'waiting',
      map: msg.map,
      roundEndsAt: msg.roundEndsAt,
    });

    this.resetBunniesToSpawn(msg.map, msg.players);
    this.showBanner('Waiting for players... Next round starts soon!');
  }

  private applyRoundStart(msg: Extract<ServerMessage, { type: 'round_start' }>): void {
    this.phase = 'playing';
    this.lastCarrotAttemptAt = 0;
    this.lastStumpAttemptAt = 0;
    this.spawnGraceUntil = Date.now() + 1200;
    this.resetContactState();

    const selfSnapshot = msg.players?.find((p) => p.username === this.selfUsername);
    this.setItemCounts(selfSnapshot?.items);

    this.loadMap(msg.map);
    this.uiCallbacks?.onRoundStart?.({
      phase: 'playing',
      map: msg.map,
      roundEndsAt: msg.roundEndsAt,
    });

    this.resetBunniesToSpawn(msg.map, msg.players);
    this.showBanner(`${msg.map.name} · Collect the Golden Carrot! 🥕`);
  }

  private resetBunniesToSpawn(map: MapData, players?: PlayerSnapshot[]): void {
    const selfSpawn = players?.find((p) => p.username === this.selfUsername);
    const spawnX = selfSpawn?.x ?? map.spawn.x;
    const spawnY = selfSpawn?.y ?? map.spawn.y;

    if (this.localBunny?.matterBody) {
      this.matter.body.setPosition(this.localBunny.matterBody, { x: spawnX, y: spawnY });
      this.matter.body.setVelocity(this.localBunny.matterBody, { x: 0, y: 0 });
      this.localBunny.setPosition(spawnX, spawnY);
      this.localBunny.setVisible(true);
      this.localState.hasCarrot = false;
      this.localState.finished = false;
      this.localBunny.carrotSprite.setVisible(false);
    }

    for (const rb of this.remoteBunnies.values()) {
      const remoteSpawn = players?.find((p) => p.username === rb.username);
      const rx = remoteSpawn?.x ?? map.spawn.x;
      const ry = remoteSpawn?.y ?? map.spawn.y;
      rb.hasCarrot = false;
      rb.finished = false;
      rb.setVisible(true);
      rb.carrotSprite.setVisible(false);
      rb.setPosition(rx, ry);
      rb.targetX = rx;
      rb.targetY = ry;
      if (rb.matterBody) {
        this.matter.body.setPosition(rb.matterBody, { x: rx, y: ry });
        rb.matterBody.isSensor = true;
      }
    }
  }

  private loadMap(map: MapData): void {
    this.currentMap = map;
    this.resetContactState();

    for (const b of this.staticBodies) {
      this.matter.world.remove(b);
    }
    this.staticBodies = [];
    this.bodyToSprite.clear();

    for (const d of this.platformDisplays) {
      d.destroy();
    }
    this.platformDisplays = [];
    for (const bg of this.bgElements) {
      bg.destroy();
    }
    this.bgElements = [];

    for (const id of Array.from(this.shamanObjects.keys())) {
      this.removeShamanObject(id);
    }

    this.carrotSprite?.destroy();
    this.carrotSprite = null;
    this.stumpSprite?.destroy();
    this.stumpSprite = null;
    this.stumpHint?.destroy();
    this.stumpHint = null;
    this.ambientEmitter?.destroy();
    this.ambientEmitter = null;

    this.buildParallaxBackground(map.theme);

    map.platforms.forEach((p, idx) => {
      if (p.material === 'bouncy') {
        const sprite = this.add.image(p.x, p.y, 'mushroom_pad').setDepth(5).setRotation(p.angle || 0);
        const body = this.matter.add.rectangle(p.x, p.y + 4, p.w, p.h, {
          isStatic: true,
          angle: p.angle || 0,
          label: 'bouncy_mushroom',
        });
        this.bodyToSprite.set(body.id, sprite);
        this.staticBodies.push(body);
        this.platformDisplays.push(sprite);
      } else {
        const texKey = `plat_${map.id}_${idx}_${p.w}x${p.h}_${p.material}`;
        drawPlatformTexture(this, texKey, p.w, p.h, p.material);
        const sprite = this.add.image(p.x, p.y, texKey).setDepth(4).setRotation(p.angle || 0);
        const body = this.matter.add.rectangle(p.x, p.y, p.w, p.h, {
          isStatic: true,
          angle: p.angle || 0,
          friction: p.material === 'ice' ? 0.01 : 0.45,
          label: p.material === 'ice' ? 'ice_platform' : 'solid_platform',
        });
        this.staticBodies.push(body);
        this.platformDisplays.push(sprite);
      }
    });

    if (this.phase === 'waiting' || map.id === 'meadow-lobby') {
      return;
    }

    this.carrotSprite = this.add.image(map.carrot.x, map.carrot.y, 'carrot').setDepth(7);
    this.tweens.add({
      targets: this.carrotSprite,
      y: map.carrot.y - 8,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.stumpSprite = this.add.image(map.stump.x, map.stump.y - 6, 'stump_nest').setDepth(6);
    this.stumpHint = this.add
      .text(map.stump.x, map.stump.y - 72, 'Stump Nest', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffe9b8',
        stroke: '#2e1d10',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(8);
  }

  private buildParallaxBackground(themeName: ThemeName): void {
    const t = THEMES[themeName] || THEMES.meadow;

    const sky = this.add.graphics().setScrollFactor(0).setDepth(0);
    sky.fillGradientStyle(t.skyTop, t.skyTop, t.skyBottom, t.skyBottom, 1);
    sky.fillRect(0, 0, this.scale.width + 400, this.scale.height + 400);
    this.bgElements.push(sky);

    const sun = this.add.circle(1180, 140, 56, t.sunColor, 0.92).setScrollFactor(0.08).setDepth(0.5);
    const sunGlow = this.add.circle(1180, 140, 92, t.sunColor, 0.2).setScrollFactor(0.08).setDepth(0.4);
    this.bgElements.push(sun, sunGlow);

    const far = this.add.graphics().setScrollFactor(0.2).setDepth(1);
    far.fillStyle(t.hillFar, 0.85);
    far.beginPath();
    far.moveTo(0, 820);
    for (let x = 0; x <= 2000; x += 180) {
      far.lineTo(x, 520 + Math.sin(x * 0.004) * 65);
    }
    far.lineTo(2000, 820);
    far.closePath();
    far.fillPath();
    this.bgElements.push(far);

    const near = this.add.graphics().setScrollFactor(0.42).setDepth(2);
    near.fillStyle(t.hillNear, 0.9);
    near.fillRect(0, 640, 2000, 200);
    for (let tx = 40; tx < 1950; tx += 110) {
      const th = 95 + (tx % 55);
      near.fillTriangle(tx, 645 - th, tx - 38, 650, tx + 38, 650);
    }
    this.bgElements.push(near);

    this.ambientEmitter = this.add
      .particles(0, 0, 'particle_sparkle', {
        x: { min: 0, max: WORLD_WIDTH },
        y: { min: 0, max: WORLD_HEIGHT },
        lifespan: 4500,
        speedX: { min: -16, max: 16 },
        speedY: { min: -12, max: 14 },
        scale: { start: 0.38, end: 0 },
        alpha: { start: 0.45, end: 0 },
        tint: t.ambientTint,
        frequency: 170,
      })
      .setDepth(3);
  }

  private createBunnyContainer(player: PlayerSnapshot): BunnyVisual {
    const texKey = ensureBunnyTexture(this, player.furColor || '#f8efe4');
    const container = this.add.container(player.x, player.y).setDepth(12) as BunnyVisual;

    const aura = this.add.circle(0, 2, 26, 0xf7c954, 0.25).setVisible(false);
    const sprite = this.add.image(0, 0, texKey);
    const carrotHeld = this.add
      .image(14, 4, 'carrot')
      .setScale(0.46)
      .setAngle(28)
      .setVisible(Boolean(player.hasCarrot));
    const crown = this.add.text(0, -34, '✨', { fontSize: '16px' }).setOrigin(0.5).setVisible(false);
    const nameTag = this.add
      .text(0, -40, player.username, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1d1610',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const emoteText = this.add.text(0, -60, '', { fontSize: '20px' }).setOrigin(0.5).setAlpha(0);

    container.add([aura, sprite, carrotHeld, crown, nameTag, emoteText]);
    container.aura = aura;
    container.bunnySprite = sprite;
    container.carrotSprite = carrotHeld;
    container.crown = crown;
    container.nameTag = nameTag;
    container.emoteText = emoteText;
    container.username = player.username;
    container.targetX = player.x;
    container.targetY = player.y;
    container.facing = player.facing || 1;
    container.animState = player.anim || 'idle';
    container.hasCarrot = Boolean(player.hasCarrot);
    container.finished = Boolean(player.finished);

    return container;
  }

  private destroyBunnyVisual(bunny: BunnyVisual): void {
    if (bunny.matterBody && this.matter?.world) {
      this.matter.world.remove(bunny.matterBody);
    }
    bunny.destroy();
  }

  private createLocalBunny(player: PlayerSnapshot): void {
    const container = this.createBunnyContainer(player);
    container.nameTag.setColor('#ffe58f');

    const mainBody = this.matter.bodies.rectangle(0, 2, 26, 40, {
      chamfer: { radius: 10 },
      friction: 0.0,
      frictionStatic: 0,
      restitution: 0.02,
      label: 'bunny_main',
    });
    const footSensor = this.matter.bodies.rectangle(0, 23, 20, 8, {
      isSensor: true,
      label: 'bunny_foot',
    });
    const wallLSensor = this.matter.bodies.rectangle(-15, 2, 6, 28, {
      isSensor: true,
      label: 'bunny_wall_l',
    });
    const wallRSensor = this.matter.bodies.rectangle(15, 2, 6, 28, {
      isSensor: true,
      label: 'bunny_wall_r',
    });

    const compound = this.matter.body.create({
      parts: [mainBody, footSensor, wallLSensor, wallRSensor],
      inertia: Infinity,
      frictionAir: 0.015,
    });

    this.matter.body.setPosition(compound, { x: player.x, y: player.y });
    this.matter.world.add(compound);
    container.matterBody = compound;
    container.setPosition(player.x, player.y);

    this.localBunny = container;
    this.localState.hasCarrot = Boolean(player.hasCarrot);
    this.localState.finished = Boolean(player.finished);
    this.localState.groundContacts = 0;
    this.localState.iceContacts = 0;
    this.localState.leftWallContacts = 0;
    this.localState.rightWallContacts = 0;

    this.cameras.main.startFollow(container, true, 0.11, 0.11);
  }

  private spawnOrUpdateRemoteBunny(p: PlayerSnapshot): void {
    let rb = this.remoteBunnies.get(p.username);
    if (!rb) {
      rb = this.createBunnyContainer(p);
      // Give remote bunnies a solid Matter.js collider so players physically collide.
      rb.matterBody = this.matter.add.rectangle(p.x, p.y + 2, 26, 40, {
        isStatic: true,
        isSensor: Boolean(p.finished) || Date.now() < this.spawnGraceUntil,
        chamfer: { radius: 10 },
        friction: 0.05,
        label: 'remote_bunny',
      });
      this.remoteBunnies.set(p.username, rb);
    } else {
      rb.targetX = p.x;
      rb.targetY = p.y;
      rb.facing = p.facing || 1;
      rb.animState = p.anim || 'idle';
      rb.hasCarrot = Boolean(p.hasCarrot);
      rb.finished = Boolean(p.finished);
      rb.carrotSprite.setVisible(rb.hasCarrot);
      rb.setVisible(!rb.finished);
      if (rb.matterBody) {
        rb.matterBody.isSensor = rb.finished || Date.now() < this.spawnGraceUntil;
      }
    }
  }

  private removeRemoteBunny(username: string): void {
    const rb = this.remoteBunnies.get(username);
    if (rb) {
      this.destroyBunnyVisual(rb);
      this.remoteBunnies.delete(username);
    }
  }

  private spawnShamanObject(obj: ShamanObject, withEffect: boolean): void {
    if (this.shamanObjects.has(obj.id)) return;

    let sprite: Phaser.GameObjects.Image | null = null;
    let matterBody: MatterJS.BodyType | null = null;

    if (obj.type === 'plank') {
      sprite = this.add.image(obj.x, obj.y, 'shaman_plank').setRotation(obj.angle || 0).setDepth(6);
      matterBody = this.matter.add.rectangle(obj.x, obj.y, 164, 20, {
        isStatic: true,
        angle: obj.angle || 0,
        friction: 0.65,
      });
    } else if (obj.type === 'crate') {
      sprite = this.add.image(obj.x, obj.y, 'shaman_crate').setRotation(obj.angle || 0).setDepth(6);
      matterBody = this.matter.add.rectangle(obj.x, obj.y, 52, 52, {
        isStatic: true,
        angle: obj.angle || 0,
        friction: 0.65,
      });
    } else if (obj.type === 'mushroom') {
      sprite = this.add.image(obj.x, obj.y, 'mushroom_pad').setRotation(obj.angle || 0).setDepth(6);
      matterBody = this.matter.add.rectangle(obj.x, obj.y + 4, 68, 34, {
        isStatic: true,
        angle: obj.angle || 0,
        label: 'bouncy_mushroom',
      });
      this.bodyToSprite.set(matterBody.id, sprite);
    } else if (obj.type === 'gust') {
      sprite = this.add.image(obj.x, obj.y, 'gust_orb').setDepth(5);
      this.tweens.add({
        targets: sprite,
        angle: 360,
        duration: 2400,
        repeat: -1,
      });
    }

    if (withEffect) {
      this.sparkleEmitter.emitParticleAt(obj.x, obj.y, 12);
      this.audio?.playShamanCast(obj.x, obj.y);
    }

    this.shamanObjects.set(obj.id, {
      id: obj.id,
      type: obj.type,
      sprite,
      matterBody,
      targetX: obj.x,
      targetY: obj.y,
      targetAngle: obj.angle || 0,
    });
  }

  private removeShamanObject(id: string): void {
    const entry = this.shamanObjects.get(id);
    if (!entry) return;
    if (entry.matterBody) {
      this.bodyToSprite.delete(entry.matterBody.id);
      this.matter.world.remove(entry.matterBody);
    }
    entry.sprite?.destroy();
    this.shamanObjects.delete(id);
  }

  private deleteShamanObjectAt(x: number, y: number): void {
    // Check objects from top to bottom so the topmost object is selected.
    const objects = Array.from(this.shamanObjects.values()).reverse();

    for (const obj of objects) {
      if (!obj.sprite) continue;

      const bounds = obj.sprite.getBounds();

      if (bounds.contains(x, y)) {
        this.socket?.send({
          type: 'shaman_remove',
          objectId: obj.id,
        });
        return;
      }
    }
  }

  private spawnShamanItemAt(x: number, y: number): void {
    if ((this.itemCounts[this.selectedShamanItem] ?? 0) <= 0) {
      return;
    }
    if (this.selectedShamanItem === 'deleter') {
      this.deleteShamanObjectAt(x, y);
      return;
    }

    this.socket?.send({
      type: 'shaman_spawn',
      itemType: this.selectedShamanItem,
      x,
      y,
      angle: this.shamanAngleRad,
    });
  }

  private applySnapshot(msg: Extract<ServerMessage, { type: 'snapshot' }>): void {
    const activeNames = new Set<string>();
    for (const p of msg.players) {
      activeNames.add(p.username);
      if (p.username === this.selfUsername) {
        if (this.localBunny) {
          this.localState.hasCarrot = Boolean(p.hasCarrot);
          this.localState.finished = Boolean(p.finished);
          this.localBunny.carrotSprite.setVisible(this.localState.hasCarrot);
        }
      } else {
        this.spawnOrUpdateRemoteBunny(p);
      }
    }

    for (const username of Array.from(this.remoteBunnies.keys())) {
      if (!activeNames.has(username)) {
        this.removeRemoteBunny(username);
      }
    }

    for (const crate of msg.crates || []) {
      const obj = this.shamanObjects.get(crate.id);
      if (obj) {
        obj.targetX = crate.x;
        obj.targetY = crate.y;
        obj.targetAngle = crate.angle;
      }
    }

    this.uiCallbacks?.onOnlineCountChanged?.(msg.players.length);
  }

  private onCarrotPicked(msg: Extract<ServerMessage, { type: 'carrot_picked' }>): void {
    this.sparkleEmitter.emitParticleAt(msg.x, msg.y, 14);
    this.audio?.playCarrot(msg.x, msg.y);
    if (msg.username === this.selfUsername && this.carrotSprite) {
      this.carrotSprite.setAlpha(0.28);
      this.localState.hasCarrot = true;
      this.localBunny?.carrotSprite.setVisible(true);
      this.stumpHint?.setText('Bring Carrot to Stump! 🥕');
      this.showBanner('Golden Carrot Collected! 🥕');
    }
  }

  private onBunnyNested(msg: Extract<ServerMessage, { type: 'bunny_nested' }>): void {
    this.leafEmitter.emitParticleAt(msg.x, msg.y - 20, 18);
    this.sparkleEmitter.emitParticleAt(msg.x, msg.y - 20, 14);
    this.audio?.playNestEntry(msg.x, msg.y);

    if (msg.username === this.selfUsername) {
      this.localState.finished = true;
      this.localBunny?.setVisible(false);
      this.stumpHint?.setText('Stump Nest');
      this.showBanner(`Placed #${msg.place} in the Stump Nest! 🥕`);
      this.uiCallbacks?.onStatsUpdated?.({
        carrotsCollected: msg.carrotsCollected,
        firstPlaces: msg.firstPlaces,
      });
    } else {
      const rb = this.remoteBunnies.get(msg.username);
      if (rb) {
        rb.finished = true;
        rb.setVisible(false);
        if (rb.matterBody) {
          rb.matterBody.isSensor = true;
        }
      }
    }
    this.uiCallbacks?.onSystemChat?.(`${msg.username} burrowed into the stump (#${msg.place})!`);
  }

  private onLocalRespawn(msg: Extract<ServerMessage, { type: 'respawn' }>): void {
    if (!this.localBunny?.matterBody) return;
    this.matter.body.setPosition(this.localBunny.matterBody, { x: msg.x, y: msg.y });
    this.matter.body.setVelocity(this.localBunny.matterBody, { x: 0, y: 0 });
    this.localState.hasCarrot = false;
    this.lastCarrotAttemptAt = 0;
    this.lastStumpAttemptAt = 0;
    this.resetContactState();
    this.spawnGraceUntil = Date.now() + 1200;
    this.localBunny.carrotSprite.setVisible(false);
    this.carrotSprite?.setAlpha(1);
    this.stumpHint?.setText(this.phase === 'waiting' ? 'Waiting for players...' : 'Stump Nest');
    this.dustEmitter.emitParticleAt(msg.x, msg.y + 16, 10);
  }

  private onBoopEffect(msg: Extract<ServerMessage, { type: 'boop_effect' }>): void {
    this.audio?.playBoop(msg.x, msg.y);
    this.sparkleEmitter.emitParticleAt(msg.x, msg.y, 10);

    const ring = this.add.circle(msg.x, msg.y, 18, 0xffdf7a, 0.35).setDepth(14);
    this.tweens.add({
      targets: ring,
      scale: 4.4,
      alpha: 0,
      duration: 280,
      onComplete: () => ring.destroy(),
    });

    if (this.localBunny?.matterBody && !this.localState.finished) {
      const hit = (msg.impulses || []).find((i) => i.username === this.selfUsername);
      if (hit) {
        this.matter.body.setVelocity(this.localBunny.matterBody, {
          x: hit.vx,
          y: hit.vy,
        });
      }
    }
  }

  private onPlayerCollision(msg: Extract<ServerMessage, { type: 'player_collision' }>): void {
    this.dustEmitter.emitParticleAt(msg.x, msg.y, 6);
    if (this.localBunny?.matterBody && !this.localState.finished) {
      const hit = (msg.impulses || []).find((i) => i.username === this.selfUsername);
      if (hit) {
        this.audio?.playHop(msg.x, msg.y);
        this.matter.body.setVelocity(this.localBunny.matterBody, {
          x: hit.vx,
          y: hit.vy,
        });
      }
    }
  }

  private showBunnyEmote(username: string, emote: string): void {
    const icon = EMOTE_ICONS[emote] || '✨';
    const bunny = username === this.selfUsername ? this.localBunny : this.remoteBunnies.get(username);
    if (!bunny) return;
    bunny.emoteText.setText(icon).setAlpha(1).setY(-58);
    this.tweens.killTweensOf(bunny.emoteText);
    this.tweens.add({
      targets: bunny.emoteText,
      y: -78,
      alpha: 0,
      duration: 2100,
      ease: 'Cubic.easeOut',
    });
  }

  private showBanner(text: string): void {
    if (!this.bannerText) return;
    this.bannerText.setText(text).setAlpha(1).setScale(0.92);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({
      targets: this.bannerText,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.bannerText,
      alpha: 0,
      delay: 2400,
      duration: 500,
    });
  }

  update(time: number, delta: number): void {
    const dtFactor = Math.min(2.5, delta / 16.67);

    if (this.phase === 'playing' && !this.localState.finished && !this.isTypingInInput() && this.keys) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) this.setShamanItem('plank');
      if (Phaser.Input.Keyboard.JustDown(this.keys.two)) this.setShamanItem('crate');
      if (Phaser.Input.Keyboard.JustDown(this.keys.three)) this.setShamanItem('mushroom');
      if (Phaser.Input.Keyboard.JustDown(this.keys.four)) this.setShamanItem('gust');
      if (Phaser.Input.Keyboard.JustDown(this.keys.five)) this.setShamanItem('deleter');
      if (Phaser.Input.Keyboard.JustDown(this.keys.q)) this.rotateShamanItem(-15);
      if (Phaser.Input.Keyboard.JustDown(this.keys.e)) this.rotateShamanItem(15);

      const pointer = this.input.activePointer;
      const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const hasRemaining = (this.itemCounts[this.selectedShamanItem] ?? 0) > 0;
      if (this.selectedShamanItem === 'deleter' || !hasRemaining) {
        this.localGhost?.setAlpha(0);
      } else {
        this.localGhost
          ?.setPosition(worldPt.x, worldPt.y)
          .setRotation(this.shamanAngleRad)
          .setAlpha(0.45);
      }
    } else {
      this.localGhost?.setAlpha(0);
    }

    for (const obj of this.shamanObjects.values()) {
      if (obj.type === 'crate' && obj.matterBody && obj.sprite) {
        const nx = Phaser.Math.Linear(obj.matterBody.position.x, obj.targetX, 0.35);
        const ny = Phaser.Math.Linear(obj.matterBody.position.y, obj.targetY, 0.35);
        const na = Phaser.Math.Angle.RotateTo(obj.matterBody.angle, obj.targetAngle, 0.25);
        this.matter.body.setPosition(obj.matterBody, { x: nx, y: ny });
        this.matter.body.setAngle(obj.matterBody, na);
        obj.sprite.setPosition(nx, ny).setRotation(na);
      } else if (obj.type === 'gust' && obj.sprite && this.localBunny?.matterBody && !this.localState.finished) {
        const dx = this.localBunny.x - obj.sprite.x;
        const dy = this.localBunny.y - obj.sprite.y;
        if (dx * dx + dy * dy < 68 * 68) {
          const curVy = this.localBunny.matterBody.velocity.y;
          this.matter.body.setVelocity(this.localBunny.matterBody, {
            x: this.localBunny.matterBody.velocity.x,
            y: Math.max(-7.6, curVy - 0.85 * dtFactor),
          });
        }
      }
    }

    if (this.localBunny && !this.localState.finished && (this.phase === 'playing' || this.phase === 'waiting')) {
      this.updateLocalBunnyMovement(time, dtFactor);
    }

    if (this.localBunny && this.phase === 'playing') {
      this.checkLocalObjectives();
    }

    const inGrace = Date.now() < this.spawnGraceUntil;
    for (const rb of this.remoteBunnies.values()) {
      rb.x = Phaser.Math.Linear(rb.x, rb.targetX, 0.32);
      rb.y = Phaser.Math.Linear(rb.y, rb.targetY, 0.32);
      if (rb.matterBody) {
        this.matter.body.setPosition(rb.matterBody, { x: rb.x, y: rb.y + 2 });
        rb.matterBody.isSensor = rb.finished || inGrace;
      }
      this.animateBunnyVisual(rb, rb.facing, rb.animState, time);
    }
  }

  private lastMissingCarrotBannerAt = 0;

  private checkLocalObjectives(): void {
    const bunny = this.localBunny;

    if (!bunny || !this.currentMap || this.localState.finished) {
      return;
    }

    const now = Date.now();
    const bunnyBounds = new Phaser.Geom.Rectangle(bunny.x - 14, bunny.y - 20, 28, 40);

    // Collect the golden carrot if the bunny touches anywhere on the carrot sprite.
    if (!this.localState.hasCarrot && this.carrotSprite && now - this.lastCarrotAttemptAt >= 200) {
      const carrotBounds = this.carrotSprite.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(bunnyBounds, carrotBounds)) {
        this.lastCarrotAttemptAt = now;
        this.socket?.send({ type: 'carrot_pickup' });
      }
    }

    // Enter the stump nest if the bunny touches anywhere on the stump sprite.
    if (this.stumpSprite) {
      const stumpBounds = this.stumpSprite.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(bunnyBounds, stumpBounds)) {
        if (!this.localState.hasCarrot) {
          this.stumpHint?.setText('Grab the Golden Carrot first! 🥕');
          if (now - this.lastMissingCarrotBannerAt > 2500) {
            this.lastMissingCarrotBannerAt = now;
            this.showBanner('Grab the Golden Carrot first! 🥕');
          }
          return;
        }

        if (now - this.lastStumpAttemptAt >= 200) {
          this.lastStumpAttemptAt = now;
          this.socket?.send({ type: 'stump_reach' });
        }
      }
    }
  }

  private updateLocalBunnyMovement(time: number, dtFactor: number): void {
    const bunny = this.localBunny;
    const body = bunny?.matterBody;
    if (!bunny || !body || !this.cursors || !this.keys) return;

    const state = this.localState;
    this.audio?.setListenerPosition(bunny.x, bunny.y);

    const typing = this.isTypingInInput();
    const moveLeft = !typing && (this.cursors.left.isDown || this.keys.a.isDown);
    const moveRight = !typing && (this.cursors.right.isDown || this.keys.d.isDown);
    const jumpPressed =
      !typing &&
      (Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.w) ||
        Phaser.Input.Keyboard.JustDown(this.keys.space));

    const onGround = state.groundContacts > 0;
    const onIce = state.iceContacts > 0;
    const onLeftWall = !onGround && state.leftWallContacts > 0;
    const onRightWall = !onGround && state.rightWallContacts > 0;

    if (onGround && time >= state.justJumpedUntil && body.velocity.y >= -0.6) {
      state.coyoteUntil = time + 115;
    }
    if (jumpPressed) {
      state.jumpBufferUntil = time + 125;
    }

    let vx = body.velocity.x;
    let vy = body.velocity.y;
    const targetSpeed = 5.4;

    if (moveLeft) {
      state.facing = -1;
      const accel = onIce ? 0.16 : onGround ? 0.95 : 0.55;
      vx = Phaser.Math.Linear(vx, -targetSpeed, Math.min(1, accel * dtFactor));
    } else if (moveRight) {
      state.facing = 1;
      const accel = onIce ? 0.16 : onGround ? 0.95 : 0.55;
      vx = Phaser.Math.Linear(vx, targetSpeed, Math.min(1, accel * dtFactor));
    } else {
      const friction = onIce ? 0.02 : onGround ? 0.32 : 0.08;
      vx = Phaser.Math.Linear(vx, 0, Math.min(1, friction * dtFactor));
    }

    if ((onLeftWall && moveLeft) || (onRightWall && moveRight)) {
      if (vy > 2.2) vy = 2.2;
    }

    if (time <= state.jumpBufferUntil && time >= state.justJumpedUntil) {
      if (time <= state.coyoteUntil) {
        vy = -10.4;
        state.jumpBufferUntil = 0;
        state.coyoteUntil = 0;
        state.justJumpedUntil = time + 150;
        this.audio?.playHop(bunny.x, bunny.y);
        this.dustEmitter.emitParticleAt(bunny.x, bunny.y + 20, 6);
      } else if (onLeftWall || onRightWall) {
        vy = -9.6;
        vx = onLeftWall ? 5.8 : -5.8;
        state.facing = onLeftWall ? 1 : -1;
        state.jumpBufferUntil = 0;
        state.justJumpedUntil = time + 150;
        this.audio?.playHop(bunny.x, bunny.y);
        this.dustEmitter.emitParticleAt(bunny.x + (onLeftWall ? -12 : 12), bunny.y, 6);
      }
    }

    this.matter.body.setVelocity(body, { x: vx, y: vy });

    if (!typing && Phaser.Input.Keyboard.JustDown(this.keys.f) && time - state.lastBoopAt > 1400) {
      state.lastBoopAt = time;
      this.socket?.send({ type: 'boop' });
    }

    if (!onGround) {
      state.anim = onLeftWall || onRightWall ? 'wall' : vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(vx) > 0.65) {
      state.anim = 'run';
    } else {
      state.anim = 'idle';
    }

    this.animateBunnyVisual(bunny, state.facing, state.anim, time);

    if (bunny.y > WORLD_HEIGHT + 70 && time - this.lastRespawnSentAt > 400) {
      this.lastRespawnSentAt = time;
      this.socket?.send({ type: 'respawn_request' });
      this.matter.body.setPosition(body, {
        x: this.currentMap?.spawn.x || 160,
        y: this.currentMap?.spawn.y || 540,
      });
      this.matter.body.setVelocity(body, { x: 0, y: 0 });
    }

    if (time - state.lastStateSentAt >= 40) {
      state.lastStateSentAt = time;
      this.socket?.send({
        type: 'state',
        x: bunny.x,
        y: bunny.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        facing: state.facing,
        anim: state.anim,
      });
    }
  }

  private animateBunnyVisual(container: BunnyVisual, facing: 1 | -1, anim: AnimState, time: number): void {
    container.bunnySprite.setFlipX(facing === -1);
    container.carrotSprite.setPosition(facing * 14, 4).setFlipX(facing === -1);

    if (anim === 'run') {
      const hop = Math.abs(Math.sin(time * 0.018));
      container.bunnySprite.setScale(1 + hop * 0.08, 1 - hop * 0.1);
      container.bunnySprite.setY(-hop * 4);
    } else if (anim === 'jump') {
      container.bunnySprite.setScale(0.9, 1.12);
      container.bunnySprite.setY(0);
    } else if (anim === 'fall') {
      container.bunnySprite.setScale(1.06, 0.94);
      container.bunnySprite.setY(0);
    } else {
      const breathe = Math.sin(time * 0.004) * 0.03;
      container.bunnySprite.setScale(1 + breathe, 1 - breathe);
      container.bunnySprite.setY(0);
    }
  }
}
