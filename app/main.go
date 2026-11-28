package main

import (
	"log"
	"net/http"

	"gophers/network"
	"gophers/rooms"
)

// nosniff adds X-Content-Type-Options: nosniff to every HTTP response.
func nosniff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func main() {
	roomManager := rooms.NewManager()
	mux := http.NewServeMux()

	// Exactly "/" (the {$} stops it from matching every path).
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	// WebSocket endpoint for multiplayer gameplay (works over ws:// and wss://).
	mux.HandleFunc("GET /ws", func(w http.ResponseWriter, r *http.Request) {
		network.ServeWS(roomManager, w, r)
	})

	// Everything under /static/.
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	log.Println("listening on :8000")
	log.Fatal(http.ListenAndServe(":8000", nosniff(mux)))
}
