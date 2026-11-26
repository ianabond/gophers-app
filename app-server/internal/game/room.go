package game

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"

	"gophers-app/app-server/internal/auth"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxShamanObjects   = 14
	shamanCooldown     = 750 * time.Millisecond
	boopCooldown       = 1400 * time.Millisecond
	boopRadius         = 95.0
	carrotPickupRadius = 56.0
	stumpEntryRadius   = 68.0
	gustLifetime       = 9 * time.Second
)

var validEmotes = map[string]bool{
	"carrot":  true,
	"heart":   true,
	"sparkle": true,
	"boop":    true,
	"gg":      true,
}

var validShamanTypes = map[string]bool{
	"plank":    true,
	"crate":    true,
	"mushroom": true,
	"gust":     true,
}

var validAnims = map[string]bool{
	"idle": true,
	"run":  true,
	"jump": true,
	"fall": true,
	"wall": true,
}

type Client struct {
	User *auth.VerifiedUser
	Conn *websocket.Conn
	Send chan []byte
}

type PlayerState struct {
	Client           *Client
	Username         string  `json:"username"`
	FurColor         string  `json:"furColor"`
	X                float64 `json:"x"`
	Y                float64 `json:"y"`
	VX               float64 `json:"vx"`
	VY               float64 `json:"vy"`
	Facing           int     `json:"facing"`
	Anim             string  `json:"anim"`
	HasCarrot        bool    `json:"hasCarrot"`
	Finished         bool    `json:"finished"`
	Place            *int    `json:"place"`
	CarrotsCollected int     `json:"carrotsCollected"`
	FirstPlaces      int     `json:"firstPlaces"`
	ShamanSaves      int     `json:"shamanSaves"`
	lastBoopAt       time.Time
	lastShamanAt     time.Time
}

type ShamanObject struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	VX        float64   `json:"-"`
	VY        float64   `json:"-"`
	Angle     float64   `json:"angle"`
	ExpiresAt time.Time `json:"-"`
}

type CrateSnapshot struct {
	ID    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Angle float64 `json:"angle"`
}

type incomingEvent struct {
	client *Client
	raw    []byte
}

type joinEvent struct {
	client *Client
}

type Room struct {
	pool *pgxpool.Pool

	joinCh  chan joinEvent
	leaveCh chan *Client
	msgCh   chan incomingEvent

	currentMapDef *MapDef // holds the map definition for the current round
	players       map[string]*PlayerState
	playerOrder   []string
	mapIndex      int
	roundNumber   int
	shaman        string
	shamanIdx     int
	phase         string
	roundEndsAt   int64
	interEndsAt   int64
	finishCount   int
	nextObjID     int
	objectOrder   []string
	objects       map[string]*ShamanObject
}

func NewRoom(pool *pgxpool.Pool) *Room {
	r := &Room{
		pool:    pool,
		joinCh:  make(chan joinEvent, 32),
		leaveCh: make(chan *Client, 32),
		msgCh:   make(chan incomingEvent, 256),
		players: make(map[string]*PlayerState),
		objects: make(map[string]*ShamanObject),
	}
	r.loadRound(0)
	return r
}

func (r *Room) Run() {
	physicsTick := time.NewTicker(33 * time.Millisecond)
	snapshotTick := time.NewTicker(50 * time.Millisecond)
	defer physicsTick.Stop()
	defer snapshotTick.Stop()

	for {
		select {
		case ev := <-r.joinCh:
			r.handleJoin(ev.client)
		case c := <-r.leaveCh:
			r.handleLeave(c)
		case ev := <-r.msgCh:
			r.handleMessage(ev.client, ev.raw)
		case <-physicsTick.C:
			r.stepPhysics()
		case <-snapshotTick.C:
			r.broadcastSnapshot()
		}
	}
}

func (r *Room) Join(c *Client) {
	r.joinCh <- joinEvent{client: c}
}

func (r *Room) Leave(c *Client) {
	r.leaveCh <- c
}

func (r *Room) EnqueueMessage(c *Client, raw []byte) {
	select {
	case r.msgCh <- incomingEvent{client: c, raw: raw}:
	default:
	}
}

func (r *Room) currentMap() MapDef {
	return Maps[r.mapIndex%len(Maps)]
}

func (r *Room) loadRound(idx int) {
	r.mapIndex = idx % len(Maps)
	r.roundNumber++
	r.phase = "playing"
	r.finishCount = 0
	r.objects = make(map[string]*ShamanObject)
	r.objectOrder = nil

	m := r.currentMap()
	r.roundEndsAt = time.Now().Add(time.Duration(m.RoundDurationSec) * time.Second).UnixMilli()
	r.pickNextShaman()

	for _, p := range r.players {
		p.X = m.Spawn.X + (rand.Float64()*40 - 20)
		p.Y = m.Spawn.Y
		p.VX = 0
		p.VY = 0
		p.Facing = 1
		p.Anim = "idle"
		p.HasCarrot = false
		p.Finished = false
		p.Place = nil
		p.lastShamanAt = time.Time{}
	}

	r.broadcastJSON(map[string]any{
		"type":        "round_start",
		"roundNumber": r.roundNumber,
		"map":         m,
		"shaman":      r.shamanPtr(),
		"roundEndsAt": r.roundEndsAt,
	}, "")
}

func (r *Room) shamanPtr() *string {
	if r.shaman == "" {
		return nil
	}
	s := r.shaman
	return &s
}

func (r *Room) pickNextShaman() {
	if len(r.playerOrder) == 0 {
		r.shaman = ""
		return
	}
	r.shamanIdx = (r.shamanIdx + 1) % len(r.playerOrder)
	r.shaman = r.playerOrder[r.shamanIdx]
}

func (r *Room) handleJoin(c *Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	furColor := c.User.FurColor
	var carrots, firsts, saves int
	err := r.pool.QueryRow(ctx,
		`SELECT fur_color, carrots_collected, first_places, shaman_saves
		 FROM users WHERE username = $1`, c.User.Username,
	).Scan(&furColor, &carrots, &firsts, &saves)
	if err != nil {
		log.Printf("load player stats (%s): %v", c.User.Username, err)
	}

	// Disconnect older connection for same username if active
	if old, ok := r.players[c.User.Username]; ok && old.Client != c {
		close(old.Client.Send)
		_ = old.Client.Conn.Close()
	} else if !ok {
		r.playerOrder = append(r.playerOrder, c.User.Username)
	}

	m := r.currentMap()
	p := &PlayerState{
		Client:           c,
		Username:         c.User.Username,
		FurColor:         furColor,
		X:                m.Spawn.X + (rand.Float64()*40 - 20),
		Y:                m.Spawn.Y,
		Facing:           1,
		Anim:             "idle",
		CarrotsCollected: carrots,
		FirstPlaces:      firsts,
		ShamanSaves:      saves,
	}
	r.players[c.User.Username] = p
	if r.shaman == "" {
		r.shaman = p.Username
	}

	r.sendJSON(c, map[string]any{
		"type":         "welcome",
		"selfUsername": p.Username,
		"roundNumber":  r.roundNumber,
		"phase":        r.phase,
		"map":          m,
		"shaman":       r.shamanPtr(),
		"roundEndsAt":  r.roundEndsAt,
		"objects":      r.serializeObjects(),
		"players":      r.serializePlayers(),
	})

	r.broadcastJSON(map[string]any{
		"type":   "player_joined",
		"player": p,
		"shaman": r.shamanPtr(),
	}, p.Username)
}

func (r *Room) handleLeave(c *Client) {
	p, ok := r.players[c.User.Username]
	if !ok || p.Client != c {
		return
	}

	delete(r.players, c.User.Username)
	close(c.Send)
	for i, name := range r.playerOrder {
		if name == c.User.Username {
			r.playerOrder = append(r.playerOrder[:i], r.playerOrder[i+1:]...)
			break
		}
	}

	if r.shaman == c.User.Username {
		r.pickNextShaman()
	}

	r.broadcastJSON(map[string]any{
		"type":     "player_left",
		"username": c.User.Username,
		"shaman":   r.shamanPtr(),
	}, "")
}

type clientMsgEnvelope struct {
	Type     string  `json:"type"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	VX       float64 `json:"vx"`
	VY       float64 `json:"vy"`
	Facing   int     `json:"facing"`
	Anim     string  `json:"anim"`
	ItemType string  `json:"itemType"`
	Angle    float64 `json:"angle"`
	Emote    string  `json:"emote"`
	Text     string  `json:"text"`
}

func (r *Room) handleMessage(c *Client, raw []byte) {
	p, ok := r.players[c.User.Username]
	if !ok || p.Client != c {
		return
	}

	var msg clientMsgEnvelope
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	switch msg.Type {
	case "state":
		r.handleState(p, msg)
	case "boop":
		r.handleBoop(p)
	case "shaman_preview":
		r.handleShamanPreview(p, msg)
	case "shaman_spawn":
		r.handleShamanSpawn(p, msg)
	case "emote":
		if validEmotes[msg.Emote] {
			r.broadcastJSON(map[string]any{
				"type":     "emote",
				"username": p.Username,
				"emote":    msg.Emote,
			}, "")
		}
	case "chat":
		text := strings.TrimSpace(msg.Text)
		if len(text) > 140 {
			text = text[:140]
		}
		if text != "" {
			r.broadcastJSON(map[string]any{
				"type":     "chat",
				"username": p.Username,
				"text":     text,
			}, "")
		}
	}
}

func isFinite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func (r *Room) handleState(p *PlayerState, msg clientMsgEnvelope) {
	if r.phase != "playing" || p.Finished {
		return
	}
	if !isFinite(msg.X) || !isFinite(msg.Y) || !isFinite(msg.VX) || !isFinite(msg.VY) {
		return
	}

	m := r.currentMap()
	if msg.Y > WorldHeight+80 {
		p.X = m.Spawn.X
		p.Y = m.Spawn.Y
		p.VX = 0
		p.VY = 0
		p.HasCarrot = false
		r.sendJSON(p.Client, map[string]any{
			"type":          "respawn",
			"x":             p.X,
			"y":             p.Y,
			"droppedCarrot": true,
		})
		return
	}

	p.X = clamp(msg.X, 20, WorldWidth-20)
	p.Y = clamp(msg.Y, -120, WorldHeight+80)
	p.VX = clamp(msg.VX, -900, 900)
	p.VY = clamp(msg.VY, -1100, 1100)
	if msg.Facing == -1 {
		p.Facing = -1
	} else {
		p.Facing = 1
	}
	if validAnims[msg.Anim] {
		p.Anim = msg.Anim
	}

	if !p.HasCarrot {
		dx := p.X - m.Carrot.X
		dy := p.Y - m.Carrot.Y
		if dx*dx+dy*dy <= carrotPickupRadius*carrotPickupRadius {
			p.HasCarrot = true
			r.broadcastJSON(map[string]any{
				"type":     "carrot_picked",
				"username": p.Username,
				"x":        m.Carrot.X,
				"y":        m.Carrot.Y,
			}, "")
		}
	}

	if p.HasCarrot && !p.Finished {
		dx := p.X - m.Stump.X
		dy := p.Y - m.Stump.Y
		if dx*dx+dy*dy <= stumpEntryRadius*stumpEntryRadius {
			r.completeBunnyRun(p)
		}
	}
}

func (r *Room) completeBunnyRun(p *PlayerState) {
	p.Finished = true
	r.finishCount++
	place := r.finishCount
	p.Place = &place
	p.CarrotsCollected++
	firstDelta := 0
	if place == 1 {
		p.FirstPlaces++
		firstDelta = 1
	}

	var shamanPlayer *PlayerState
	if r.shaman != "" && r.shaman != p.Username {
		if sp, ok := r.players[r.shaman]; ok {
			sp.ShamanSaves++
			shamanPlayer = sp
		}
	}

	var shamanName *string
	if shamanPlayer != nil {
		s := shamanPlayer.Username
		shamanName = &s
	}

	r.broadcastJSON(map[string]any{
		"type":             "bunny_nested",
		"username":         p.Username,
		"place":            place,
		"x":                r.currentMap().Stump.X,
		"y":                r.currentMap().Stump.Y,
		"shamanUsername":   shamanName,
		"carrotsCollected": p.CarrotsCollected,
		"firstPlaces":      p.FirstPlaces,
	}, "")

	// Persist scores asynchronously without blocking the room tick
	pool := r.pool
	username := p.Username
	shamanUser := ""
	if shamanPlayer != nil {
		shamanUser = shamanPlayer.Username
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if _, err := pool.Exec(ctx,
			`UPDATE users
			 SET carrots_collected = carrots_collected + 1,
			     first_places = first_places + $2
			 WHERE username = $1`,
			username, firstDelta,
		); err != nil {
			log.Printf("persist bunny score (%s): %v", username, err)
		}
		if shamanUser != "" {
			if _, err := pool.Exec(ctx,
				`UPDATE users SET shaman_saves = shaman_saves + 1 WHERE username = $1`,
				shamanUser,
			); err != nil {
				log.Printf("persist shaman save (%s): %v", shamanUser, err)
			}
		}
	}()

	allFinished := len(r.players) > 0
	for _, pl := range r.players {
		if !pl.Finished {
			allFinished = false
			break
		}
	}
	if allFinished {
		soon := time.Now().Add(3500 * time.Millisecond).UnixMilli()
		if soon < r.roundEndsAt {
			r.roundEndsAt = soon
			r.broadcastJSON(map[string]any{
				"type":        "round_ending_soon",
				"roundEndsAt": r.roundEndsAt,
			}, "")
		}
	}
}

func (r *Room) handleBoop(p *PlayerState) {
	if r.phase != "playing" || p.Finished {
		return
	}
	now := time.Now()
	if now.Sub(p.lastBoopAt) < boopCooldown {
		return
	}
	p.lastBoopAt = now

	type impulse struct {
		Username string  `json:"username"`
		VX       float64 `json:"vx"`
		VY       float64 `json:"vy"`
	}
	impulses := make([]impulse, 0)

	for _, other := range r.players {
		if other.Username == p.Username || other.Finished {
			continue
		}
		dx := other.X - p.X
		dy := other.Y - p.Y
		dist := math.Hypot(dx, dy)
		if dist <= boopRadius {
			nx := float64(p.Facing)
			ny := -0.4
			if dist > 1 {
				nx = dx / dist
				ny = dy / dist
			}
			impulses = append(impulses, impulse{
				Username: other.Username,
				VX:       nx * 360,
				VY:       math.Min(-240, ny*260-160),
			})
		}
	}

	for _, obj := range r.objects {
		if obj.Type != "crate" {
			continue
		}
		dx := obj.X - p.X
		dy := obj.Y - p.Y
		dist := math.Hypot(dx, dy)
		if dist <= boopRadius+20 {
			nx := float64(p.Facing)
			if dist > 1 {
				nx = dx / dist
			}
			obj.VX += nx * 240
			obj.VY -= 180
		}
	}

	r.broadcastJSON(map[string]any{
		"type":     "boop_effect",
		"from":     p.Username,
		"x":        p.X,
		"y":        p.Y,
		"impulses": impulses,
	}, "")
}

func (r *Room) handleShamanPreview(p *PlayerState, msg clientMsgEnvelope) {
	if r.phase != "playing" || p.Username != r.shaman {
		return
	}
	if !validShamanTypes[msg.ItemType] || !isFinite(msg.X) || !isFinite(msg.Y) || !isFinite(msg.Angle) {
		return
	}
	r.broadcastJSON(map[string]any{
		"type":     "shaman_preview",
		"shaman":   p.Username,
		"itemType": msg.ItemType,
		"x":        clamp(msg.X, 30, WorldWidth-30),
		"y":        clamp(msg.Y, 30, WorldHeight-30),
		"angle":    clamp(msg.Angle, -math.Pi, math.Pi),
	}, p.Username)
}

func (r *Room) handleShamanSpawn(p *PlayerState, msg clientMsgEnvelope) {
	if r.phase != "playing" || p.Username != r.shaman {
		return
	}
	now := time.Now()
	if now.Sub(p.lastShamanAt) < shamanCooldown {
		return
	}
	if !validShamanTypes[msg.ItemType] || !isFinite(msg.X) || !isFinite(msg.Y) || !isFinite(msg.Angle) {
		return
	}

	p.lastShamanAt = now
	if len(r.objectOrder) >= maxShamanObjects {
		r.removeObject(r.objectOrder[0])
	}

	r.nextObjID++
	id := fmt.Sprintf("obj_%d", r.nextObjID)
	obj := &ShamanObject{
		ID:    id,
		Type:  msg.ItemType,
		X:     clamp(msg.X, 40, WorldWidth-40),
		Y:     clamp(msg.Y, 40, WorldHeight-40),
		Angle: clamp(msg.Angle, -math.Pi, math.Pi),
	}
	if msg.ItemType == "gust" {
		obj.ExpiresAt = now.Add(gustLifetime)
	}

	r.objects[id] = obj
	r.objectOrder = append(r.objectOrder, id)

	r.broadcastJSON(map[string]any{
		"type":   "object_spawned",
		"object": obj,
		"shaman": p.Username,
	}, "")
}

func (r *Room) removeObject(id string) {
	if _, ok := r.objects[id]; !ok {
		return
	}
	delete(r.objects, id)
	for i, oid := range r.objectOrder {
		if oid == id {
			r.objectOrder = append(r.objectOrder[:i], r.objectOrder[i+1:]...)
			break
		}
	}
	r.broadcastJSON(map[string]any{
		"type": "object_removed",
		"id":   id,
	}, "")
}

func (r *Room) stepPhysics() {
	now := time.Now()
	nowMs := now.UnixMilli()

	if r.phase == "playing" && nowMs >= r.roundEndsAt {
		r.phase = "intermission"
		r.interEndsAt = nowMs + 3000
		r.broadcastJSON(map[string]any{
			"type":        "round_ended",
			"roundNumber": r.roundNumber,
			"nextRoundAt": r.interEndsAt,
		}, "")
	} else if r.phase == "intermission" && nowMs >= r.interEndsAt {
		r.loadRound(r.mapIndex + 1)
		return
	}

	const dt = 0.033
	const gravity = 760.0
	const crateHalf = 26.0

	m := r.currentMap()
	toRemove := make([]string, 0)

	for _, id := range r.objectOrder {
		obj := r.objects[id]
		if obj == nil {
			continue
		}
		if !obj.ExpiresAt.IsZero() && now.After(obj.ExpiresAt) {
			toRemove = append(toRemove, id)
			continue
		}
		if obj.Type != "crate" {
			continue
		}

		// Gentle bunny horizontal pushing
		for _, p := range r.players {
			if p.Finished {
				continue
			}
			if math.Abs(obj.X-p.X) < 42 && math.Abs(obj.Y-p.Y) < 42 {
				if p.VX > 20 {
					obj.VX += 18
				} else if p.VX < -20 {
					obj.VX -= 18
				}
			}
		}

		obj.VY += gravity * dt
		obj.VX *= 0.90
		obj.X = clamp(obj.X+obj.VX*dt, crateHalf, WorldWidth-crateHalf)
		obj.Y += obj.VY * dt

		// Resolve crate resting on static map platforms & Shaman planks
		onSolid := false
		for _, plat := range m.Platforms {
			if resolveCrateAgainstRect(obj, plat.X, plat.Y, plat.W, plat.H, plat.Angle, crateHalf) {
				onSolid = true
				if plat.Material == "bouncy" {
					obj.VY = -460
				}
			}
		}
		for _, other := range r.objects {
			if other.ID == obj.ID {
				continue
			}
			switch other.Type {
			case "plank":
				if resolveCrateAgainstRect(obj, other.X, other.Y, 164, 20, other.Angle, crateHalf) {
					onSolid = true
				}
			case "mushroom":
				if resolveCrateAgainstRect(obj, other.X, other.Y+4, 68, 34, other.Angle, crateHalf) {
					obj.VY = -460
				}
			case "crate":
				if resolveCrateAgainstRect(obj, other.X, other.Y, 52, 52, 0, crateHalf) {
					onSolid = true
				}
			}
		}
		if onSolid {
			obj.Angle *= 0.85
		}

		if obj.Y > WorldHeight+120 {
			toRemove = append(toRemove, id)
		}
	}

	for _, id := range toRemove {
		r.removeObject(id)
	}
}

// resolveCrateAgainstRect performs lightweight rotated-rect collision so server-owned crates
// fall, rest, and slide cleanly on flat and angled planks.
func resolveCrateAgainstRect(crate *ShamanObject, rx, ry, rw, rh, angle, crateHalf float64) bool {
	dx := crate.X - rx
	dy := crate.Y - ry
	cosA := math.Cos(-angle)
	sinA := math.Sin(-angle)
	localX := dx*cosA - dy*sinA
	localY := dx*sinA + dy*cosA

	halfW := rw/2 + crateHalf
	halfH := rh/2 + crateHalf
	if math.Abs(localX) >= halfW || math.Abs(localY) >= halfH {
		return false
	}

	overlapX := halfW - math.Abs(localX)
	overlapY := halfH - math.Abs(localY)

	if overlapY <= overlapX && localY <= 0 {
		// Landed on top surface of rectangle
		localY = -halfH
		cosW := math.Cos(angle)
		sinW := math.Sin(angle)
		crate.X = rx + (localX*cosW - localY*sinW)
		crate.Y = ry + (localX*sinW + localY*cosW)
		if crate.VY > 0 {
			crate.VY = 0
		}
		crate.Angle = angle * 0.5
		return true
	}

	if overlapX < overlapY {
		if localX < 0 {
			crate.X -= overlapX * 0.5
		} else {
			crate.X += overlapX * 0.5
		}
		crate.VX *= -0.2
	}
	return false
}

func (r *Room) broadcastSnapshot() {
	if len(r.players) == 0 {
		return
	}
	crates := make([]CrateSnapshot, 0)
	for _, id := range r.objectOrder {
		obj := r.objects[id]
		if obj != nil && obj.Type == "crate" {
			crates = append(crates, CrateSnapshot{
				ID:    obj.ID,
				X:     math.Round(obj.X*10) / 10,
				Y:     math.Round(obj.Y*10) / 10,
				Angle: math.Round(obj.Angle*1000) / 1000,
			})
		}
	}

	r.broadcastJSON(map[string]any{
		"type":       "snapshot",
		"players":    r.serializePlayers(),
		"crates":     crates,
		"serverTime": time.Now().UnixMilli(),
	}, "")
}

func (r *Room) serializePlayers() []*PlayerState {
	out := make([]*PlayerState, 0, len(r.playerOrder))
	for _, name := range r.playerOrder {
		if p, ok := r.players[name]; ok {
			out = append(out, p)
		}
	}
	return out
}

func (r *Room) serializeObjects() []*ShamanObject {
	out := make([]*ShamanObject, 0, len(r.objectOrder))
	for _, id := range r.objectOrder {
		if obj, ok := r.objects[id]; ok {
			out = append(out, obj)
		}
	}
	return out
}

func (r *Room) sendJSON(c *Client, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	select {
	case c.Send <- data:
	default:
	}
}

func (r *Room) broadcastJSON(payload any, excludeUsername string) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	for _, p := range r.players {
		if excludeUsername != "" && p.Username == excludeUsername {
			continue
		}
		select {
		case p.Client.Send <- data:
		default:
		}
	}
}
