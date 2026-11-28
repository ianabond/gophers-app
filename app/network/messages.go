package network

import "gophers/game"

// ClientMessage represents every message the browser can send over WebSocket.
type ClientMessage struct {
	Type     string  `json:"type"`
	X        float64 `json:"x,omitempty"`
	Y        float64 `json:"y,omitempty"`
	VX       float64 `json:"vx,omitempty"`
	VY       float64 `json:"vy,omitempty"`
	Facing   int     `json:"facing,omitempty"`
	Anim     string  `json:"anim,omitempty"`
	ItemType string  `json:"itemType,omitempty"`
	Angle    float64 `json:"angle,omitempty"`
	ObjectID string  `json:"objectId,omitempty"`
	Emote    string  `json:"emote,omitempty"`
}

// ServerMessage represents every message the server broadcasts over WebSocket.
type ServerMessage struct {
	Type             string              `json:"type"`
	SelfUsername     string              `json:"selfUsername,omitempty"`
	RoomID           string              `json:"roomId,omitempty"`
	RoomName         string              `json:"roomName,omitempty"`
	RoomPlayers      int                 `json:"roomPlayers,omitempty"`
	MaxPlayers       int                 `json:"maxPlayers,omitempty"`
	RoundNumber      int                 `json:"roundNumber,omitempty"`
	Phase            string              `json:"phase,omitempty"`
	Map              *game.MapData       `json:"map,omitempty"`
	Shaman           *string             `json:"shaman,omitempty"`
	RoundEndsAt      int64               `json:"roundEndsAt,omitempty"`
	NextRoundAt      int64               `json:"nextRoundAt,omitempty"`
	Objects          []game.ShamanObject `json:"objects,omitempty"`
	Object           *game.ShamanObject  `json:"object,omitempty"`
	ID               string              `json:"id,omitempty"`
	Players          []game.Player       `json:"players,omitempty"`
	Player           *game.Player        `json:"player,omitempty"`
	Username         string              `json:"username,omitempty"`
	Place            int                 `json:"place,omitempty"`
	ShamanUsername   *string             `json:"shamanUsername,omitempty"`
	CarrotsCollected int                 `json:"carrotsCollected,omitempty"`
	FirstPlaces      int                 `json:"firstPlaces,omitempty"`
	DroppedCarrot    bool                `json:"droppedCarrot,omitempty"`
	From             string              `json:"from,omitempty"`
	X                float64             `json:"x,omitempty"`
	Y                float64             `json:"y,omitempty"`
	ItemType         string              `json:"itemType,omitempty"`
	Angle            float64             `json:"angle,omitempty"`
	Impulses         []game.Impulse      `json:"impulses,omitempty"`
	Emote            string              `json:"emote,omitempty"`
	ServerTime       int64               `json:"serverTime,omitempty"`
}
