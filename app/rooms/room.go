package rooms

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"

	"gophers/game"
	"gophers/network"
)

const (
	MaxPlayersPerRoom    = 8
	tickInterval         = 40 * time.Millisecond
	intermissionDuration = 3 * time.Second
	spawnGracePeriod     = 1200 * time.Millisecond
	boopCooldown         = 1200 * time.Millisecond
)

var defaultWaitingDuration = 20 * time.Second

type joinRequest struct {
	client   *network.Client
	username string
	furColor string
	reply    chan bool
}

type clientAction struct {
	client *network.Client
	msg    network.ClientMessage
}

// Room runs a single multiplayer game room inside its own goroutine.
type Room struct {
	ID   string
	Name string

	clients   map[*network.Client]*game.Player
	joinOrder []*network.Client

	objects     map[string]game.ShamanObject
	objectOrder []string
	nextObjID   int

	currentMap      game.MapData
	lastMapID       string
	lastPlayedMapID string
	roundNumber     int
	phase           string
	waitingDuration time.Duration
	roundEndsAt     time.Time
	nextRoundAt     time.Time
	shamanUsername string
	firstFinisher  string
	finishedCount  int
	pairCollisions map[string]time.Time

	joinCh  chan joinRequest
	leaveCh chan *network.Client
	msgCh   chan clientAction
	done    chan struct{}
	onEmpty func(roomID string)
}

// NewRoom creates a new room ready to be started with `go room.Run()`.
func NewRoom(id, name string, onEmpty func(roomID string)) *Room {
	return &Room{
		ID:              id,
		Name:            name,
		clients:         make(map[*network.Client]*game.Player),
		objects:         make(map[string]game.ShamanObject),
		pairCollisions:  make(map[string]time.Time),
		waitingDuration: defaultWaitingDuration,
		joinCh:          make(chan joinRequest),
		leaveCh:         make(chan *network.Client, 16),
		msgCh:           make(chan clientAction, 256),
		done:            make(chan struct{}),
		onEmpty:         onEmpty,
	}
}

// TryJoin asks the room goroutine to admit a guest, returning false if full or closed.
func (r *Room) TryJoin(c *network.Client, username, furColor string) bool {
	reply := make(chan bool, 1)
	select {
	case r.joinCh <- joinRequest{client: c, username: username, furColor: furColor, reply: reply}:
	case <-r.done:
		return false
	}

	select {
	case accepted := <-reply:
		return accepted
	case <-r.done:
		return false
	}
}

// HandleClientMessage forwards a player's WebSocket message to the room goroutine.
func (r *Room) HandleClientMessage(c *network.Client, msg network.ClientMessage) {
	select {
	case r.msgCh <- clientAction{client: c, msg: msg}:
	case <-r.done:
	}
}

// Leave notifies the room goroutine that a player disconnected.
func (r *Room) Leave(c *network.Client) {
	select {
	case r.leaveCh <- c:
	case <-r.done:
	}
}

// Run owns all game logic and state mutations for this room on a dedicated goroutine.
func (r *Room) Run() {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case req := <-r.joinCh:
			req.reply <- r.addClient(req.client, req.username, req.furColor, time.Now())

		case c := <-r.leaveCh:
			if empty := r.removeClient(c); empty {
				close(r.done)
				if r.onEmpty != nil {
					go r.onEmpty(r.ID)
				}
				return
			}

		case act := <-r.msgCh:
			r.handleAction(act.client, act.msg, time.Now())

		case now := <-ticker.C:
			r.stepTick(now)
		}
	}
}

func (r *Room) addClient(c *network.Client, rawName, rawColor string, now time.Time) bool {
	if len(r.clients) >= MaxPlayersPerRoom {
		return false
	}

	if len(r.clients) == 0 && r.roundNumber == 0 && r.phase == "" {
		r.startWaitingPhase(now)
	}

	username := r.uniqueUsername(sanitizeUsername(rawName))
	furColor := sanitizeColor(rawColor)

	slotOffset := float64((len(r.clients)%5)-2) * 14
	player := &game.Player{
		Username:            username,
		FurColor:            furColor,
		X:                   r.currentMap.Spawn.X + slotOffset,
		Y:                   r.currentMap.Spawn.Y,
		Facing:              1,
		Anim:                "idle",
		SpawnProtectedUntil: now.Add(spawnGracePeriod),
	}

	c.Username = username
	c.FurColor = furColor

	r.clients[c] = player
	r.joinOrder = append(r.joinOrder, c)

	if r.phase == game.PhasePlaying && r.shamanUsername == "" {
		r.shamanUsername = username
	}

	// Send full room snapshot to the newly joined player.
	c.SendJSON(network.ServerMessage{
		Type:         "welcome",
		SelfUsername: username,
		RoomID:       r.ID,
		RoomName:     r.Name,
		RoomPlayers:  len(r.clients),
		MaxPlayers:   MaxPlayersPerRoom,
		RoundNumber:  r.roundNumber,
		Phase:        r.phase,
		Map:          &r.currentMap,
		Shaman:       r.shamanPtr(),
		RoundEndsAt:  r.roundEndsAt.UnixMilli(),
		Objects:      r.objectList(),
		Players:      r.playerSnapshots(),
	})

	// Notify everyone else in the room.
	r.broadcastExcept(c, network.ServerMessage{
		Type:        "player_joined",
		Player:      player,
		Shaman:      r.shamanPtr(),
		RoomID:      r.ID,
		RoomName:    r.Name,
		RoomPlayers: len(r.clients),
		MaxPlayers:  MaxPlayersPerRoom,
	})

	return true
}

func (r *Room) removeClient(c *network.Client) bool {
	player, exists := r.clients[c]
	if !exists {
		return len(r.clients) == 0
	}

	delete(r.clients, c)
	c.CloseSend()

	for i, existing := range r.joinOrder {
		if existing == c {
			r.joinOrder = append(r.joinOrder[:i], r.joinOrder[i+1:]...)
			break
		}
	}

	if len(r.clients) == 0 {
		return true
	}

	if r.phase == game.PhasePlaying && r.shamanUsername == player.Username {
		r.shamanUsername = r.clients[r.joinOrder[0]].Username
	}

	r.broadcast(network.ServerMessage{
		Type:        "player_left",
		Username:    player.Username,
		Shaman:      r.shamanPtr(),
		RoomID:      r.ID,
		RoomName:    r.Name,
		RoomPlayers: len(r.clients),
		MaxPlayers:  MaxPlayersPerRoom,
	})

	return false
}

func (r *Room) handleAction(c *network.Client, msg network.ClientMessage, now time.Time) {
	player, ok := r.clients[c]
	if !ok {
		return
	}

	switch msg.Type {
	case "state":
		if (r.phase != game.PhasePlaying && r.phase != game.PhaseWaiting) || player.Finished {
			return
		}
		player.X = clampFloat(msg.X, -80, 1680)
		player.Y = clampFloat(msg.Y, -200, 960)
		player.VX = clampFloat(msg.VX, -30, 30)
		player.VY = clampFloat(msg.VY, -30, 30)
		if msg.Facing == -1 || msg.Facing == 1 {
			player.Facing = msg.Facing
		}
		if msg.Anim != "" {
			player.Anim = msg.Anim
		}

	case "carrot_pickup":
		if r.phase != game.PhasePlaying || player.Finished || player.HasCarrot {
			return
		}
		player.HasCarrot = true
		r.broadcast(network.ServerMessage{
			Type:     "carrot_picked",
			Username: player.Username,
			X:        r.currentMap.Carrot.X,
			Y:        r.currentMap.Carrot.Y,
		})

	case "stump_reach":
		if r.phase != game.PhasePlaying || player.Finished || !player.HasCarrot {
			return
		}
		// Shaman waits until all other bunnies in the room have finished.
		if player.Username == r.shamanUsername {
			for _, other := range r.clients {
				if other != player && !other.Finished {
					return
				}
			}
		}

		r.finishedCount++
		place := r.finishedCount
		player.Finished = true
		player.Place = &place
		player.CarrotsCollected++
		if place == 1 {
			player.FirstPlaces++
			r.firstFinisher = player.Username
		}
		if r.shamanUsername != "" && r.shamanUsername != player.Username {
			if shaman := r.playerByName(r.shamanUsername); shaman != nil {
				shaman.ShamanSaves++
			}
		}

		r.broadcast(network.ServerMessage{
			Type:             "bunny_nested",
			Username:         player.Username,
			Place:            place,
			X:                r.currentMap.Stump.X,
			Y:                r.currentMap.Stump.Y,
			ShamanUsername:   r.shamanPtr(),
			CarrotsCollected: player.CarrotsCollected,
			FirstPlaces:      player.FirstPlaces,
		})

		// Shorten remaining round time to 10s once the first bunny finishes.
		if place == 1 && time.Until(r.roundEndsAt) > 10*time.Second {
			r.roundEndsAt = now.Add(10 * time.Second)
			r.broadcast(network.ServerMessage{
				Type:        "round_ending_soon",
				RoundEndsAt: r.roundEndsAt.UnixMilli(),
			})
		}

	case "respawn_request":
		if (r.phase != game.PhasePlaying && r.phase != game.PhaseWaiting) || player.Finished {
			return
		}
		dropped := player.HasCarrot
		player.HasCarrot = false
		player.X = r.currentMap.Spawn.X
		player.Y = r.currentMap.Spawn.Y
		player.VX = 0
		player.VY = 0
		player.SpawnProtectedUntil = now.Add(spawnGracePeriod)

		c.SendJSON(network.ServerMessage{
			Type:          "respawn",
			X:             player.X,
			Y:             player.Y,
			DroppedCarrot: dropped,
		})

	case "boop":
		if (r.phase != game.PhasePlaying && r.phase != game.PhaseWaiting) || player.Finished || now.Sub(player.LastBoopAt) < boopCooldown {
			return
		}
		player.LastBoopAt = now
		impulses := game.ResolveBoop(player, r.playerPtrs(), now)
		r.broadcast(network.ServerMessage{
			Type:     "boop_effect",
			From:     player.Username,
			X:        player.X,
			Y:        player.Y,
			Impulses: impulses,
		})

	case "shaman_spawn":
		if r.phase != game.PhasePlaying || player.Username != r.shamanUsername {
			return
		}
		if !isValidShamanItem(msg.ItemType) {
			return
		}
		r.nextObjID++
		obj := game.ShamanObject{
			ID:    fmt.Sprintf("obj-%d-%d", r.roundNumber, r.nextObjID),
			Type:  msg.ItemType,
			X:     clampFloat(msg.X, 0, 1600),
			Y:     clampFloat(msg.Y, 0, 800),
			Angle: msg.Angle,
		}
		r.objects[obj.ID] = obj
		r.objectOrder = append(r.objectOrder, obj.ID)
		r.broadcast(network.ServerMessage{
			Type:   "object_spawned",
			Object: &obj,
			Shaman: r.shamanPtr(),
		})

	case "shaman_remove":
		if r.phase != game.PhasePlaying || player.Username != r.shamanUsername {
			return
		}
		if _, exists := r.objects[msg.ObjectID]; !exists {
			return
		}
		delete(r.objects, msg.ObjectID)
		r.broadcast(network.ServerMessage{
			Type: "object_removed",
			ID:   msg.ObjectID,
		})

	case "shaman_preview":
		if r.phase != game.PhasePlaying || player.Username != r.shamanUsername {
			return
		}
		r.broadcastExcept(c, network.ServerMessage{
			Type:     "shaman_preview",
			Shaman:   r.shamanPtr(),
			ItemType: msg.ItemType,
			X:        msg.X,
			Y:        msg.Y,
			Angle:    msg.Angle,
		})

	case "emote":
		if msg.Emote == "" {
			return
		}
		r.broadcast(network.ServerMessage{
			Type:     "emote",
			Username: player.Username,
			Emote:    msg.Emote,
		})
	}
}

func (r *Room) stepTick(now time.Time) {
	if len(r.clients) == 0 {
		return
	}

	if r.phase == game.PhaseWaiting || r.phase == game.PhasePlaying {
		// Run player-to-player collision checks inside the room goroutine.
		collisions := game.ResolvePlayerCollisions(r.playerPtrs(), r.pairCollisions, now)
		for _, col := range collisions {
			r.broadcast(network.ServerMessage{
				Type:     "player_collision",
				X:        col.X,
				Y:        col.Y,
				Impulses: col.Impulses,
			})
		}
	}

	if r.phase == game.PhaseWaiting {
		if !now.Before(r.roundEndsAt) {
			r.startNewRound(now, r.pickNextShaman())
			r.broadcast(network.ServerMessage{
				Type:        "round_start",
				RoundNumber: r.roundNumber,
				Map:         &r.currentMap,
				Shaman:      r.shamanPtr(),
				RoundEndsAt: r.roundEndsAt.UnixMilli(),
				Players:     r.playerSnapshots(),
			})
		}
	} else if r.phase == game.PhasePlaying {
		// End round if timer expired or every player in the room reached the burrow.
		allFinished := len(r.clients) > 0
		for _, p := range r.clients {
			if !p.Finished {
				allFinished = false
				break
			}
		}
		if now.After(r.roundEndsAt) || allFinished {
			r.phase = game.PhaseIntermission
			r.nextRoundAt = now.Add(intermissionDuration)
			r.broadcast(network.ServerMessage{
				Type:        "round_ended",
				RoundNumber: r.roundNumber,
				NextRoundAt: r.nextRoundAt.UnixMilli(),
			})
		}
	} else if r.phase == game.PhaseIntermission && !now.Before(r.nextRoundAt) {
		r.startWaitingPhase(now)
		r.broadcast(network.ServerMessage{
			Type:        "waiting_start",
			RoundNumber: r.roundNumber,
			Map:         &r.currentMap,
			RoundEndsAt: r.roundEndsAt.UnixMilli(),
			Players:     r.playerSnapshots(),
			RoomID:      r.ID,
			RoomName:    r.Name,
			RoomPlayers: len(r.clients),
			MaxPlayers:  MaxPlayersPerRoom,
		})
	}

	r.broadcast(network.ServerMessage{
		Type:       "snapshot",
		Players:    r.playerSnapshots(),
		ServerTime: now.UnixMilli(),
	})
}

func (r *Room) startWaitingPhase(now time.Time) {
	r.currentMap = game.PickRandomMap(r.lastMapID)
	r.lastMapID = r.currentMap.ID
	r.phase = game.PhaseWaiting
	r.roundEndsAt = now.Add(r.waitingDuration)
	r.shamanUsername = ""
	r.finishedCount = 0
	r.objects = make(map[string]game.ShamanObject)
	r.objectOrder = nil
	r.pairCollisions = make(map[string]time.Time)

	for idx, c := range r.joinOrder {
		p := r.clients[c]
		offset := float64((idx%5)-2) * 14
		p.X = r.currentMap.Spawn.X + offset
		p.Y = r.currentMap.Spawn.Y
		p.VX = 0
		p.VY = 0
		p.HasCarrot = false
		p.Finished = false
		p.Place = nil
		p.Anim = "idle"
		p.SpawnProtectedUntil = now.Add(spawnGracePeriod)
	}
}

func (r *Room) startNewRound(now time.Time, nextShaman string) {
	r.roundNumber++
	r.currentMap = game.PickRandomMap(r.lastPlayedMapID)
	r.lastMapID = r.currentMap.ID
	r.lastPlayedMapID = r.currentMap.ID
	r.phase = game.PhasePlaying
	r.roundEndsAt = now.Add(time.Duration(r.currentMap.RoundDurationSec) * time.Second)
	r.firstFinisher = ""
	r.finishedCount = 0
	r.objects = make(map[string]game.ShamanObject)
	r.objectOrder = nil
	r.pairCollisions = make(map[string]time.Time)

	if nextShaman != "" {
		r.shamanUsername = nextShaman
	} else if len(r.joinOrder) > 0 {
		r.shamanUsername = r.clients[r.joinOrder[0]].Username
	}

	for idx, c := range r.joinOrder {
		p := r.clients[c]
		offset := float64((idx%5)-2) * 14
		p.X = r.currentMap.Spawn.X + offset
		p.Y = r.currentMap.Spawn.Y
		p.VX = 0
		p.VY = 0
		p.HasCarrot = false
		p.Finished = false
		p.Place = nil
		p.Anim = "idle"
		p.SpawnProtectedUntil = now.Add(spawnGracePeriod)
	}
}

func (r *Room) pickNextShaman() string {
	if r.firstFinisher != "" && r.playerByName(r.firstFinisher) != nil {
		return r.firstFinisher
	}
	if len(r.joinOrder) == 0 {
		return ""
	}
	c := r.joinOrder[rand.IntN(len(r.joinOrder))]
	return r.clients[c].Username
}

func (r *Room) playerPtrs() []*game.Player {
	list := make([]*game.Player, 0, len(r.joinOrder))
	for _, c := range r.joinOrder {
		if p, ok := r.clients[c]; ok {
			list = append(list, p)
		}
	}
	return list
}

func (r *Room) playerSnapshots() []game.Player {
	list := make([]game.Player, 0, len(r.joinOrder))
	for _, c := range r.joinOrder {
		if p, ok := r.clients[c]; ok {
			list = append(list, *p)
		}
	}
	return list
}

func (r *Room) objectList() []game.ShamanObject {
	list := make([]game.ShamanObject, 0, len(r.objectOrder))
	for _, id := range r.objectOrder {
		if obj, ok := r.objects[id]; ok {
			list = append(list, obj)
		}
	}
	return list
}

func (r *Room) playerByName(username string) *game.Player {
	for _, p := range r.clients {
		if p.Username == username {
			return p
		}
	}
	return nil
}

func (r *Room) uniqueUsername(base string) string {
	candidate := base
	suffix := 2
	for r.playerByName(candidate) != nil {
		tag := fmt.Sprintf("%d", suffix)
		maxBase := 20 - len(tag)
		if len(base) > maxBase {
			candidate = base[:maxBase] + tag
		} else {
			candidate = base + tag
		}
		suffix++
	}
	return candidate
}

func (r *Room) shamanPtr() *string {
	if r.shamanUsername == "" {
		return nil
	}
	s := r.shamanUsername
	return &s
}

func (r *Room) broadcast(msg network.ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, c := range r.joinOrder {
		c.SendBytes(data)
	}
}

func (r *Room) broadcastExcept(skip *network.Client, msg network.ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for _, c := range r.joinOrder {
		if c != skip {
			c.SendBytes(data)
		}
	}
}

func sanitizeUsername(raw string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		name = "Guest"
	}
	if len(name) > 20 {
		name = name[:20]
	}
	return name
}

func sanitizeColor(raw string) string {
	c := strings.TrimSpace(raw)
	if len(c) == 7 && c[0] == '#' {
		return c
	}
	return "#f8efe4"
}

func isValidShamanItem(item string) bool {
	switch item {
	case "plank", "crate", "mushroom", "gust":
		return true
	default:
		return false
	}
}

func clampFloat(v, minVal, maxVal float64) float64 {
	if v < minVal {
		return minVal
	}
	if v > maxVal {
		return maxVal
	}
	return v
}
