package main

import (
	"context"
	"log"
	"os"
	"time"

	"gophers/auth-server/internal/handlers"
	"gophers/auth-server/internal/keys"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

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

func main() {
	port := getEnv("PORT", "3001")
	keysDir := getEnv("KEYS_DIR", "/keys")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	keyPair, err := keys.LoadOrCreate(keysDir)
	if err != nil {
		log.Fatalf("load/create RSA keys: %v", err)
	}

	ctx := context.Background()
	pool, err := connectDBWithRetry(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	_ = r.SetTrustedProxies(nil)

	h := handlers.NewHandler(pool, keyPair, 24*time.Hour)
	r.GET("/health", h.Health)
	r.GET("/public-key", h.PublicKey)
	r.POST("/register", handlers.VerifySameOrigin(), h.Register)
	r.POST("/login", handlers.VerifySameOrigin(), h.Login)
	r.POST("/logout", handlers.VerifySameOrigin(), h.Logout)

	log.Printf("Auth server (Go/Gin) listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
