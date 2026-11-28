package game

import (
	"math"
	"time"
)

const (
	BunnyWidth        = 28.0
	BunnyHeight       = 40.0
	BoopRadius        = 92.0
	CollisionCooldown = 160 * time.Millisecond
)

func pairKey(a, b string) string {
	if a < b {
		return a + "|" + b
	}
	return b + "|" + a
}

// ResolvePlayerCollisions checks overlapping bunny hitboxes and produces bounce impulses.
func ResolvePlayerCollisions(players []*Player, lastPairs map[string]time.Time, now time.Time) []CollisionEvent {
	var events []CollisionEvent

	for i := 0; i < len(players); i++ {
		a := players[i]
		if a.Finished || now.Before(a.SpawnProtectedUntil) {
			continue
		}

		for j := i + 1; j < len(players); j++ {
			b := players[j]
			if b.Finished || now.Before(b.SpawnProtectedUntil) {
				continue
			}

			dx := b.X - a.X
			dy := b.Y - a.Y
			overlapX := BunnyWidth - math.Abs(dx)
			overlapY := BunnyHeight - math.Abs(dy)
			if overlapX <= 0 || overlapY <= 0 {
				continue
			}

			key := pairKey(a.Username, b.Username)
			if prev, ok := lastPairs[key]; ok && now.Sub(prev) < CollisionCooldown {
				continue
			}
			lastPairs[key] = now

			var impA, impB Impulse
			if overlapY < overlapX && math.Abs(dy) > 8 {
				// Vertical collision: top bunny bounces up, bottom bunny gets pressed down.
				if a.Y < b.Y {
					impA = Impulse{Username: a.Username, VX: a.VX, VY: -7.2}
					impB = Impulse{Username: b.Username, VX: b.VX, VY: math.Max(b.VY, 2.4)}
				} else {
					impA = Impulse{Username: a.Username, VX: a.VX, VY: math.Max(a.VY, 2.4)}
					impB = Impulse{Username: b.Username, VX: b.VX, VY: -7.2}
				}
			} else {
				// Horizontal bump: push both bunnies apart.
				dir := 1.0
				if dx < 0 || (dx == 0 && a.Username > b.Username) {
					dir = -1.0
				}
				impA = Impulse{Username: a.Username, VX: -dir * 4.8, VY: -2.2}
				impB = Impulse{Username: b.Username, VX: dir * 4.8, VY: -2.2}
			}

			events = append(events, CollisionEvent{
				X:        (a.X + b.X) / 2,
				Y:        (a.Y + b.Y) / 2,
				Impulses: []Impulse{impA, impB},
			})
		}
	}

	return events
}

// ResolveBoop calculates knockback impulses for nearby players when a bunny uses Boop.
func ResolveBoop(from *Player, players []*Player, now time.Time) []Impulse {
	if from == nil || from.Finished {
		return nil
	}

	var impulses []Impulse
	for _, p := range players {
		if p == from || p.Finished || now.Before(p.SpawnProtectedUntil) {
			continue
		}

		dx := p.X - from.X
		dy := p.Y - from.Y
		dist := math.Hypot(dx, dy)
		if dist > BoopRadius {
			continue
		}

		dirX := float64(from.Facing)
		if dirX == 0 {
			dirX = 1
		}
		if dist >= 1 {
			dirX = dx / dist
		}

		force := 5.5 + 3.5*(1-dist/BoopRadius)
		impulses = append(impulses, Impulse{
			Username: p.Username,
			VX:       dirX * force,
			VY:       -4.8,
		})
	}

	return impulses
}
