package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gophers-app/app-server/internal/auth"
	"gophers-app/app-server/internal/game"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LeaderboardEntry struct {
	Username         string `json:"username"`
	FurColor         string `json:"furColor"`
	CarrotsCollected int    `json:"carrotsCollected"`
	FirstPlaces      int    `json:"firstPlaces"`
	ShamanSaves      int    `json:"shamanSaves"`
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func connectDBWithRetry(ctx context.Context, connStr string) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for attempt := 1; attempt <= 25; attempt++ {
		pool, err = pgxpool.New(ctx, connStr)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				return pool, nil
			} else {
				err = pingErr
				pool.Close()
			}
		}
		log.Printf("Waiting for PostgreSQL (attempt %d/25): %v", attempt, err)
		time.Sleep(time.Second)
	}
	return nil, err
}

func checkWebSocketOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	expectedHost := r.Header.Get("X-Forwarded-Host")
	if expectedHost == "" {
		expectedHost = r.Host
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return parsed.Host != "" && parsed.Host == expectedHost
}

func writePump(client *game.Client) {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		_ = client.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-client.Send:
			_ = client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := client.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func main() {
	port := getEnv("PORT", "3000")
	publicKeyURL := getEnv("AUTH_PUBLIC_KEY_URL", "http://auth-server:3001/public-key")
	publicDir := getEnv("PUBLIC_DIR", "/app/public")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := connectDBWithRetry(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	verifier, err := auth.FetchVerifierWithRetry(publicKeyURL)
	if err != nil {
		log.Fatalf("fetch auth public key: %v", err)
	}

	room := game.NewRoom(pool)
	go room.Run()

	upgrader := websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin:     checkWebSocketOrigin,
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	_ = r.SetTrustedProxies(nil)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/api/me", verifier.Middleware(), func(c *gin.Context) {
		u := c.MustGet("user").(*auth.VerifiedUser)
		var id int64
		var username, furColor string
		var carrots, firsts, saves int

		err := pool.QueryRow(c.Request.Context(),
			`SELECT id, username, fur_color, carrots_collected, first_places, shaman_saves
			 FROM users WHERE username = $1`,
			u.Username,
		).Scan(&id, &username, &furColor, &carrots, &firsts, &saves)
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Account not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load profile"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"user": gin.H{
				"id":               id,
				"username":         username,
				"furColor":         furColor,
				"carrotsCollected": carrots,
				"firstPlaces":      firsts,
				"shamanSaves":      saves,
			},
		})
	})

	r.GET("/api/leaderboard", func(c *gin.Context) {
		rows, err := pool.Query(c.Request.Context(),
			`SELECT username, fur_color, carrots_collected, first_places, shaman_saves
			 FROM users
			 ORDER BY carrots_collected DESC, first_places DESC, username ASC
			 LIMIT 10`,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
			return
		}
		defer rows.Close()

		entries := make([]LeaderboardEntry, 0, 10)
		for rows.Next() {
			var e LeaderboardEntry
			if err := rows.Scan(&e.Username, &e.FurColor, &e.CarrotsCollected, &e.FirstPlaces, &e.ShamanSaves); err == nil {
				entries = append(entries, e)
			}
		}
		c.JSON(http.StatusOK, gin.H{"leaderboard": entries})
	})

	r.GET("/ws", func(c *gin.Context) {
		if !checkWebSocketOrigin(c.Request) {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		tokenStr, err := c.Cookie("auth_token")
		if err != nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		user, err := verifier.VerifyToken(tokenStr)
		if err != nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &game.Client{
			User: user,
			Conn: conn,
			Send: make(chan []byte, 64),
		}
		go writePump(client)
		room.Join(client)

		conn.SetReadLimit(4096)
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		})

		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				break
			}
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			room.EnqueueMessage(client, raw)
		}

		room.Leave(client)
	})

	// Serve built React/Phaser frontend assets with SPA fallback
	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path
		if strings.HasPrefix(reqPath, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		cleaned := filepath.Clean(strings.TrimPrefix(reqPath, "/"))
		if cleaned != "." && cleaned != "" {
			candidate := filepath.Join(publicDir, cleaned)
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				c.File(candidate)
				return
			}
		}
		c.File(filepath.Join(publicDir, "index.html"))
	})

	log.Printf("App server (Go/Gin) listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
