package handlers

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gophers/auth-server/internal/keys"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`)

var allowedFurColors = map[string]bool{
	"#f8efe4": true,
	"#e8cbb1": true,
	"#d6d2d2": true,
	"#5b514d": true,
	"#f7d6e0": true,
	"#d8e8d4": true,
	"#d6e5f3": true,
	"#f5dfa6": true,
}

type Handler struct {
	pool    *pgxpool.Pool
	keyPair *keys.KeyPair
	ttl     time.Duration
}

type AuthClaims struct {
	Username string `json:"username"`
	FurColor string `json:"furColor"`
	jwt.RegisteredClaims
}

type UserDTO struct {
	ID               int64  `json:"id"`
	Username         string `json:"username"`
	FurColor         string `json:"furColor"`
	CarrotsCollected int    `json:"carrotsCollected"`
	FirstPlaces      int    `json:"firstPlaces"`
	ShamanSaves      int    `json:"shamanSaves"`
}

type registerRequest struct {
	Username string `json:"username" form:"username"`
	Password string `json:"password" form:"password"`
	FurColor string `json:"furColor" form:"furColor"`
}

type loginRequest struct {
	Username string `json:"username" form:"username"`
	Password string `json:"password" form:"password"`
}

func NewHandler(pool *pgxpool.Pool, kp *keys.KeyPair, ttl time.Duration) *Handler {
	return &Handler{pool: pool, keyPair: kp, ttl: ttl}
}

func VerifySameOrigin() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}
		expectedHost := c.GetHeader("X-Forwarded-Host")
		if expectedHost == "" {
			expectedHost = c.Request.Host
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Host == "" || parsed.Host != expectedHost {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Cross-origin request rejected"})
			return
		}
		c.Next()
	}
}

func isHTTPS(r *http.Request) bool {
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		first := strings.TrimSpace(strings.Split(proto, ",")[0])
		return strings.EqualFold(first, "https")
	}
	return r.TLS != nil
}

func (h *Handler) issueCookie(c *gin.Context, user UserDTO) error {
	now := time.Now()
	claims := AuthClaims{
		Username: user.Username,
		FurColor: user.FurColor,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(user.ID, 10),
			Issuer:    "gophers-auth",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(h.ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(h.keyPair.Private)
	if err != nil {
		return err
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("auth_token", signed, int(h.ttl.Seconds()), "/", "", isHTTPS(c.Request), true)
	return nil
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) PublicKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"publicKey": h.keyPair.PublicPEM,
		"algorithm": "RS256",
	})
}

func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if !usernameRe.MatchString(username) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Username must be 3-20 characters using letters, numbers, or underscores.",
		})
		return
	}
	if len(req.Password) < 6 || len(req.Password) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Password must be between 6 and 128 characters.",
		})
		return
	}

	furColor := "#f8efe4"
	if allowedFurColors[req.FurColor] {
		furColor = req.FurColor
	}

	var exists int
	err := h.pool.QueryRow(c.Request.Context(),
		"SELECT id FROM users WHERE LOWER(username) = LOWER($1)", username,
	).Scan(&exists)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "That bunny name is already taken."})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed."})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed."})
		return
	}

	var user UserDTO
	err = h.pool.QueryRow(c.Request.Context(),
		`INSERT INTO users (username, password_hash, fur_color)
		 VALUES ($1, $2, $3)
		 RETURNING id, username, fur_color, carrots_collected, first_places, shaman_saves`,
		username, string(hash), furColor,
	).Scan(&user.ID, &user.Username, &user.FurColor, &user.CarrotsCollected, &user.FirstPlaces, &user.ShamanSaves)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "That bunny name is already taken."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed."})
		return
	}

	if err := h.issueCookie(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required."})
		return
	}

	var user UserDTO
	var passwordHash string
	err := h.pool.QueryRow(c.Request.Context(),
		`SELECT id, username, password_hash, fur_color, carrots_collected, first_places, shaman_saves
		 FROM users
		 WHERE LOWER(username) = LOWER($1)`,
		username,
	).Scan(&user.ID, &user.Username, &passwordHash, &user.FurColor, &user.CarrotsCollected, &user.FirstPlaces, &user.ShamanSaves)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Login failed."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password."})
		return
	}

	if err := h.issueCookie(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("auth_token", "", -1, "/", "", isHTTPS(c.Request), true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
