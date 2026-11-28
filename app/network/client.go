package network

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 45 * time.Second
	maxMessageSize = 4096
)

// RoomHandle is implemented by a room to receive player messages and disconnects.
type RoomHandle interface {
	HandleClientMessage(c *Client, msg ClientMessage)
	Leave(c *Client)
}

// RoomJoiner assigns an incoming WebSocket client to a room.
type RoomJoiner interface {
	JoinGuest(c *Client, username, furColor string) (RoomHandle, error)
}

func extractHostname(hostPort string) string {
	hostPort = strings.TrimSpace(hostPort)
	if hostPort == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(hostPort); err == nil {
		return strings.Trim(host, "[]")
	}
	return strings.Trim(hostPort, "[]")
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		u, err := url.Parse(origin)
		if err != nil {
			log.Printf("websocket rejected invalid origin %q: %v", origin, err)
			return false
		}
		originHost := extractHostname(u.Host)
		if originHost == "localhost" || originHost == "127.0.0.1" || originHost == "::1" {
			return true
		}
		reqHost := extractHostname(r.Host)
		fwdHost := extractHostname(r.Header.Get("X-Forwarded-Host"))
		if (reqHost != "" && strings.EqualFold(originHost, reqHost)) ||
			(fwdHost != "" && strings.EqualFold(originHost, fwdHost)) {
			return true
		}
		log.Printf("websocket rejected origin=%q (host=%q, x-forwarded-host=%q)", origin, r.Host, r.Header.Get("X-Forwarded-Host"))
		return false
	},
}

// Client represents a single connected WebSocket player.
type Client struct {
	Conn     *websocket.Conn
	Username string
	FurColor string

	mu     sync.Mutex
	send   chan []byte
	closed bool
}

func newClient(conn *websocket.Conn) *Client {
	return &Client{
		Conn: conn,
		send: make(chan []byte, 64),
	}
}

// SendBytes queues a serialized JSON message for the client's writePump.
func (c *Client) SendBytes(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	select {
	case c.send <- data:
	default:
		// Drop slow client if its outbound buffer is saturated.
		c.closed = true
		close(c.send)
	}
}

// SendJSON marshals a message and queues it for delivery.
func (c *Client) SendJSON(v any) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	c.SendBytes(data)
}

// CloseSend closes the outbound channel once.
func (c *Client) CloseSend() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.send)
	}
}

func (c *Client) readPump(room RoomHandle) {
	defer func() {
		room.Leave(c)
		_ = c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		return c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, payload, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
				log.Printf("websocket read error (%s): %v", c.Username, err)
			}
			break
		}
		var msg ClientMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			continue
		}
		room.HandleClientMessage(c, msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case data, ok := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWS upgrades an HTTP(S) request to a WS/WSS connection and puts the guest into a room.
func ServeWS(joiner RoomJoiner, w http.ResponseWriter, r *http.Request) {
	// TODO (Objective 2): Verify JWT from the WebSocket handshake request here
	// and use the verified username instead of the guest query parameter.
	username := r.URL.Query().Get("username")
	furColor := r.URL.Query().Get("furColor")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}

	client := newClient(conn)
	go client.writePump()

	room, err := joiner.JoinGuest(client, username, furColor)
	if err != nil {
		log.Printf("room join failed: %v", err)
		client.CloseSend()
		_ = conn.Close()
		return
	}

	client.readPump(room)
}
