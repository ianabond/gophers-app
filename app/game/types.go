package game

import "time"

const (
	PhaseWaiting      = "waiting"
	PhasePlaying      = "playing"
	PhaseIntermission = "intermission"
)

// Point represents a 2D coordinate in the game world.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// PlatformData describes a static platform on a map.
type PlatformData struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	W        float64 `json:"w"`
	H        float64 `json:"h"`
	Material string  `json:"material"`
	Angle    float64 `json:"angle"`
}

// MapData describes a playable map layout and round duration.
type MapData struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	Theme            string         `json:"theme"`
	RoundDurationSec int            `json:"roundDurationSec"`
	Spawn            Point          `json:"spawn"`
	Carrot           Point          `json:"carrot"`
	Stump            Point          `json:"stump"`
	Platforms        []PlatformData `json:"platforms"`
}

// ShamanObject represents an item summoned into the world by the shaman.
type ShamanObject struct {
	ID    string  `json:"id"`
	Type  string  `json:"type"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
}

// DefaultItemInventory returns a fresh 1-of-each item inventory for a round.
func DefaultItemInventory() map[string]int {
	return map[string]int{
		"plank":    1,
		"crate":    1,
		"mushroom": 1,
		"gust":     1,
		"deleter":  1,
	}
}

// Player holds the live state for one bunny inside a room.
type Player struct {
	Username         string         `json:"username"`
	FurColor         string         `json:"furColor"`
	X                float64        `json:"x"`
	Y                float64        `json:"y"`
	VX               float64        `json:"vx"`
	VY               float64        `json:"vy"`
	Facing           int            `json:"facing"`
	Anim             string         `json:"anim"`
	HasCarrot        bool           `json:"hasCarrot"`
	Finished         bool           `json:"finished"`
	Place            *int           `json:"place"`
	CarrotsCollected int            `json:"carrotsCollected"`
	FirstPlaces      int            `json:"firstPlaces"`
	Items            map[string]int `json:"items,omitempty"`

	// Server-only fields for spawn protection and rate limiting.
	SpawnProtectedUntil time.Time `json:"-"`
	LastBoopAt          time.Time `json:"-"`
}

// Impulse represents a velocity change applied to a specific player.
type Impulse struct {
	Username string  `json:"username"`
	VX       float64 `json:"vx"`
	VY       float64 `json:"vy"`
}

// CollisionEvent records a player-to-player bump detected by the server.
type CollisionEvent struct {
	X        float64   `json:"x"`
	Y        float64   `json:"y"`
	Impulses []Impulse `json:"impulses"`
}
