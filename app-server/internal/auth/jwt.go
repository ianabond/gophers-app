package auth

import (
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Username string `json:"username"`
	FurColor string `json:"furColor"`
	jwt.RegisteredClaims
}

type VerifiedUser struct {
	UserID   int64
	Username string
	FurColor string
}

type Verifier struct {
	publicKey *rsa.PublicKey
}

type publicKeyResponse struct {
	PublicKey string `json:"publicKey"`
}

// FetchVerifierWithRetry fetches the RSA public key once from the auth server on startup.
// After startup, JWTs are verified purely locally with zero auth-server or DB calls.
func FetchVerifierWithRetry(url string) (*Verifier, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	var lastErr error

	for attempt := 1; attempt <= 25; attempt++ {
		resp, err := client.Get(url)
		if err == nil {
			var body publicKeyResponse
			decErr := json.NewDecoder(resp.Body).Decode(&body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK && decErr == nil && body.PublicKey != "" {
				pubKey, parseErr := jwt.ParseRSAPublicKeyFromPEM([]byte(body.PublicKey))
				if parseErr == nil {
					return &Verifier{publicKey: pubKey}, nil
				}
				lastErr = parseErr
			} else if decErr != nil {
				lastErr = decErr
			} else {
				lastErr = fmt.Errorf("unexpected status %d", resp.StatusCode)
			}
		} else {
			lastErr = err
		}
		log.Printf("Waiting for auth-server public key (attempt %d/25): %v", attempt, lastErr)
		time.Sleep(time.Second)
	}

	return nil, fmt.Errorf("failed to fetch public key from %s: %w", url, lastErr)
}

func (v *Verifier) VerifyToken(tokenStr string) (*VerifiedUser, error) {
	if tokenStr == "" {
		return nil, errors.New("missing token")
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(
		tokenStr,
		claims,
		func(t *jwt.Token) (any, error) {
			return v.publicKey, nil
		},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer("gophers-auth"),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid || claims.Username == "" || claims.Subject == "" {
		return nil, errors.New("invalid or expired token")
	}

	uid, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return nil, errors.New("invalid subject claim")
	}

	furColor := claims.FurColor
	if furColor == "" {
		furColor = "#f8efe4"
	}

	return &VerifiedUser{
		UserID:   uid,
		Username: claims.Username,
		FurColor: furColor,
	}, nil
}

func (v *Verifier) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie("auth_token")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		user, err := v.VerifyToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
			return
		}
		c.Set("user", user)
		c.Next()
	}
}
