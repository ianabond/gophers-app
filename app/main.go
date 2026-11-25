package main

import (
	"log"
	"net/http"
)

// adds nosniff to every response
func nosniff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()

	// exactly "/" (the {$} stops it from matching every path)
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	// everything under /static/
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	log.Println("listening on :8000")
	log.Fatal(http.ListenAndServe(":8000", nosniff(mux)))
}
