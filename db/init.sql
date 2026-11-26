CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    fur_color VARCHAR(16) NOT NULL DEFAULT '#f5e6d3',
    carrots_collected INTEGER NOT NULL DEFAULT 0,
    first_places INTEGER NOT NULL DEFAULT 0,
    shaman_saves INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_carrots ON users (carrots_collected DESC, first_places DESC);
