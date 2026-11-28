package rooms

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"gophers/network"
)

func dialTestClient(t *testing.T, serverURL, username string) (*websocket.Conn, network.ServerMessage) {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http") + "/ws?username=" + username + "&furColor=%23f8efe4"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed for %s: %v", username, err)
	}

	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var welcome network.ServerMessage
	if err := conn.ReadJSON(&welcome); err != nil {
		_ = conn.Close()
		t.Fatalf("read welcome failed for %s: %v", username, err)
	}
	if welcome.Type != "welcome" {
		_ = conn.Close()
		t.Fatalf("expected welcome message, got %q", welcome.Type)
	}
	return conn, welcome
}

func TestRoomCapacityOverflowAndCleanup(t *testing.T) {
	manager := NewManager()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		network.ServeWS(manager, w, r)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	conns := make([]*websocket.Conn, 0, 9)
	defer func() {
		for _, c := range conns {
			_ = c.Close()
		}
	}()

	// First 8 guests should all land in Room 1.
	for i := 1; i <= 8; i++ {
		c, welcome := dialTestClient(t, srv.URL, "Bunny")
		conns = append(conns, c)
		if welcome.RoomName != "Room 1" {
			t.Fatalf("player %d expected Room 1, got %q", i, welcome.RoomName)
		}
		if welcome.MaxPlayers != 8 || welcome.RoomPlayers != i {
			t.Fatalf("player %d unexpected capacity %d/%d", i, welcome.RoomPlayers, welcome.MaxPlayers)
		}
		if welcome.Phase != "waiting" {
			t.Fatalf("player %d expected waiting phase on join, got %q", i, welcome.Phase)
		}
		if welcome.Map == nil || welcome.Map.ID != "meadow-lobby" {
			t.Fatalf("player %d expected meadow-lobby waiting map, got %+v", i, welcome.Map)
		}
	}

	// 9th guest should overflow into a newly created Room 2.
	c9, welcome9 := dialTestClient(t, srv.URL, "Bunny")
	conns = append(conns, c9)
	if welcome9.RoomName != "Room 2" || welcome9.RoomPlayers != 1 {
		t.Fatalf("9th player expected Room 2 (1/8), got %q (%d/%d)", welcome9.RoomName, welcome9.RoomPlayers, welcome9.MaxPlayers)
	}

	// Close all connections and verify rooms are cleaned up.
	for _, c := range conns {
		_ = c.Close()
	}
	conns = nil

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		manager.mu.Lock()
		remaining := len(manager.rooms)
		manager.mu.Unlock()
		if remaining == 0 {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("expected all empty rooms to be cleaned up")
}

func TestPlayerCollisionAndRoundRestart(t *testing.T) {
	if defaultWaitingDuration != 20*time.Second {
		t.Fatalf("expected default waiting duration 20s, got %v", defaultWaitingDuration)
	}
	prevWait := defaultWaitingDuration
	defaultWaitingDuration = 150 * time.Millisecond
	defer func() { defaultWaitingDuration = prevWait }()

	manager := NewManager()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		network.ServeWS(manager, w, r)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	c1, _ := dialTestClient(t, srv.URL, "Alice")
	defer c1.Close()
	c2, _ := dialTestClient(t, srv.URL, "Bob")
	defer c2.Close()

	// Wait for the waiting phase to transition into Round 1.
	var round1MapID string
	var round1Shaman string
	_ = c1.SetReadDeadline(time.Now().Add(2 * time.Second))
	for {
		var msg network.ServerMessage
		if err := c1.ReadJSON(&msg); err != nil {
			t.Fatalf("did not receive Round 1 round_start: %v", err)
		}
		if msg.Type == "round_start" {
			if msg.RoundNumber != 1 || msg.Map == nil || msg.Shaman == nil {
				t.Fatalf("unexpected round_start: %+v", msg)
			}
			round1MapID = msg.Map.ID
			round1Shaman = *msg.Shaman
			break
		}
	}

	// Wait past spawn grace period so player collisions activate.
	time.Sleep(1300 * time.Millisecond)

	// Move Alice and Bob to overlapping coordinates.
	_ = c1.WriteJSON(network.ClientMessage{Type: "state", X: 500, Y: 400, VX: 2, VY: 0, Facing: 1, Anim: "run"})
	_ = c2.WriteJSON(network.ClientMessage{Type: "state", X: 508, Y: 400, VX: -2, VY: 0, Facing: -1, Anim: "run"})

	sawCollision := false
	_ = c1.SetReadDeadline(time.Now().Add(2 * time.Second))
	for !sawCollision {
		var msg network.ServerMessage
		if err := c1.ReadJSON(&msg); err != nil {
			t.Fatalf("did not receive player_collision in time: %v", err)
		}
		if msg.Type == "player_collision" {
			sawCollision = true
		}
	}

	// Complete Round 1 (non-shaman enters stump first, then shaman) and verify waiting_start before Round 2.
	_ = c1.WriteJSON(network.ClientMessage{Type: "carrot_pickup"})
	_ = c2.WriteJSON(network.ClientMessage{Type: "carrot_pickup"})
	if round1Shaman == "Alice" {
		_ = c2.WriteJSON(network.ClientMessage{Type: "stump_reach"})
		time.Sleep(50 * time.Millisecond)
		_ = c1.WriteJSON(network.ClientMessage{Type: "stump_reach"})
	} else {
		_ = c1.WriteJSON(network.ClientMessage{Type: "stump_reach"})
		time.Sleep(50 * time.Millisecond)
		_ = c2.WriteJSON(network.ClientMessage{Type: "stump_reach"})
	}

	sawWaitingBetweenRounds := false
	_ = c1.SetReadDeadline(time.Now().Add(6 * time.Second))
	for {
		var msg network.ServerMessage
		if err := c1.ReadJSON(&msg); err != nil {
			t.Fatalf("did not receive round_start after finishing: %v", err)
		}
		if msg.Type == "waiting_start" {
			if msg.Map == nil || msg.Map.ID != "meadow-lobby" {
				t.Fatalf("expected meadow-lobby during waiting_start, got %+v", msg.Map)
			}
			sawWaitingBetweenRounds = true
		}
		if msg.Type == "round_start" {
			if !sawWaitingBetweenRounds {
				t.Fatalf("expected waiting_start phase between Round 1 and Round 2")
			}
			if msg.RoundNumber != 2 {
				t.Fatalf("expected round 2, got %d", msg.RoundNumber)
			}
			if msg.Map == nil || msg.Map.ID == round1MapID {
				t.Fatalf("expected a new random map different from %q", round1MapID)
			}
			break
		}
	}
}

func TestWebSocketOriginChecks(t *testing.T) {
	manager := NewManager()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		network.ServeWS(manager, w, r)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?username=OriginTester&furColor=%23f8efe4"

	cases := []struct {
		name      string
		origin    string
		hostHdr   string
		wantAllow bool
	}{
		{name: "localhost_8080", origin: "http://localhost:8080", hostHdr: "localhost", wantAllow: true},
		{name: "lan_ip_port_stripped_by_nginx", origin: "http://192.168.1.42:8080", hostHdr: "192.168.1.42", wantAllow: true},
		{name: "prod_https_wss", origin: "https://bunnyburrowgame.fun", hostHdr: "bunnyburrowgame.fun", wantAllow: true},
		{name: "cross_origin_rejected", origin: "https://evil.example", hostHdr: "bunnyburrowgame.fun", wantAllow: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			hdr := http.Header{}
			hdr.Set("Origin", tc.origin)
			hdr.Set("Host", tc.hostHdr)
			conn, resp, err := websocket.DefaultDialer.Dial(wsURL, hdr)
			if tc.wantAllow {
				if err != nil {
					t.Fatalf("expected handshake to succeed for %s, got err=%v", tc.name, err)
				}
				_ = conn.Close()
			} else {
				if err == nil {
					_ = conn.Close()
					t.Fatalf("expected handshake to be rejected for %s", tc.name)
				}
				if resp != nil && resp.StatusCode != http.StatusForbidden {
					t.Fatalf("expected 403 Forbidden, got %d", resp.StatusCode)
				}
			}
		})
	}
}
