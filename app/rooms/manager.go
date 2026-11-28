package rooms

import (
	"fmt"
	"sync"

	"gophers/network"
)

// Manager creates and tracks active game rooms, keeping up to 8 players per room.
type Manager struct {
	mu     sync.Mutex
	rooms  []*Room
	nextID int
}

// NewManager initializes an empty RoomManager.
func NewManager() *Manager {
	return &Manager{}
}

// JoinGuest places a guest into the first room with open capacity, or creates a new room.
func (m *Manager) JoinGuest(c *network.Client, username, furColor string) (network.RoomHandle, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, room := range m.rooms {
		if room.TryJoin(c, username, furColor) {
			return room, nil
		}
	}

	m.nextID++
	roomID := fmt.Sprintf("room-%d", m.nextID)
	roomName := fmt.Sprintf("Room %d", m.nextID)
	room := NewRoom(roomID, roomName, m.removeRoom)
	m.rooms = append(m.rooms, room)
	go room.Run()

	if !room.TryJoin(c, username, furColor) {
		return nil, fmt.Errorf("failed to join newly created room %s", roomID)
	}
	return room, nil
}

func (m *Manager) removeRoom(roomID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, room := range m.rooms {
		if room.ID == roomID {
			m.rooms = append(m.rooms[:i], m.rooms[i+1:]...)
			return
		}
	}
}
