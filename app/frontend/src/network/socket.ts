import type { ClientMessage, ServerMessage } from '../types/game';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Builds the WebSocket URL using wss:// on HTTPS pages and ws:// on HTTP pages.
 */
export function buildWebSocketUrl(username: string, furColor: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({
    username,
    furColor,
  });
  return `${protocol}//${window.location.host}/ws?${params.toString()}`;
}

/**
 * Manages the WebSocket connection between the Phaser game scene and the Go backend.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private onMessage: (msg: ServerMessage) => void;
  private onStatusChange?: (status: ConnectionStatus) => void;
  private username: string;
  private furColor: string;
  private closedByClient = false;

  constructor(options: {
    username: string;
    furColor: string;
    onMessage: (msg: ServerMessage) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }) {
    this.username = options.username;
    this.furColor = options.furColor;
    this.onMessage = options.onMessage;
    this.onStatusChange = options.onStatusChange;
  }

  connect(): void {
    if (this.ws) return;
    this.closedByClient = false;
    this.onStatusChange?.('connecting');

    const ws = new WebSocket(buildWebSocketUrl(this.username, this.furColor));
    this.ws = ws;

    ws.onopen = () => {
      this.onStatusChange?.('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.onMessage(msg);
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onclose = (event) => {
      this.ws = null;
      if (!this.closedByClient) {
        console.warn('[ws] closed unexpectedly', {
          url: ws.url,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.onStatusChange?.('disconnected');
      }
    };

    ws.onerror = (event) => {
      console.warn('[ws] error', event);
    };
  }

  send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closedByClient = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
