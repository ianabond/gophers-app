package game

import (
	"testing"
	"time"
)

func TestPickRandomMapAvoidsImmediateRepeat(t *testing.T) {
	prev := AllMaps[0].ID
	for i := 0; i < 30; i++ {
		next := PickRandomMap(prev)
		if next.ID == prev {
			t.Fatalf("PickRandomMap repeated %q", prev)
		}
		prev = next.ID
	}
}

func TestResolvePlayerCollisions(t *testing.T) {
	now := time.Now()
	a := &Player{Username: "A", X: 200, Y: 500, SpawnProtectedUntil: now.Add(-time.Second)}
	b := &Player{Username: "B", X: 210, Y: 500, SpawnProtectedUntil: now.Add(-time.Second)}
	pairs := make(map[string]time.Time)

	events := ResolvePlayerCollisions([]*Player{a, b}, pairs, now)
	if len(events) != 1 {
		t.Fatalf("expected 1 collision event, got %d", len(events))
	}
	if len(events[0].Impulses) != 2 {
		t.Fatalf("expected 2 impulses, got %d", len(events[0].Impulses))
	}

	// Second check immediately inside cooldown should produce 0 events.
	events2 := ResolvePlayerCollisions([]*Player{a, b}, pairs, now.Add(20*time.Millisecond))
	if len(events2) != 0 {
		t.Fatalf("expected 0 collision events during cooldown, got %d", len(events2))
	}
}

func TestResolveBoop(t *testing.T) {
	now := time.Now()
	from := &Player{Username: "A", X: 100, Y: 100, Facing: 1, SpawnProtectedUntil: now.Add(-time.Second)}
	near := &Player{Username: "B", X: 140, Y: 100, SpawnProtectedUntil: now.Add(-time.Second)}
	far := &Player{Username: "C", X: 400, Y: 100, SpawnProtectedUntil: now.Add(-time.Second)}

	impulses := ResolveBoop(from, []*Player{from, near, far}, now)
	if len(impulses) != 1 || impulses[0].Username != "B" {
		t.Fatalf("expected boop impulse only for B, got %+v", impulses)
	}
	if impulses[0].VX <= 0 {
		t.Fatalf("expected positive VX impulse to the right, got %f", impulses[0].VX)
	}
}
