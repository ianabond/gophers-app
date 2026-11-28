package game

import "math/rand/v2"

// WaitingLobbyMap is a flat, cozy gathering area with no carrot or stump objective.
var WaitingLobbyMap = MapData{
	ID:               "meadow-lobby",
	Name:             "Meadow Lobby",
	Theme:            "meadow",
	RoundDurationSec: 20,
	Spawn:            Point{X: 800, Y: 540},
	Carrot:           Point{X: -1000, Y: -1000},
	Stump:            Point{X: -1000, Y: -1000},
	Platforms: []PlatformData{
		{X: 800, Y: 620, W: 1400, H: 60, Material: "grass", Angle: 0},
		{X: 340, Y: 480, W: 220, H: 26, Material: "wood", Angle: 0},
		{X: 1260, Y: 480, W: 220, H: 26, Material: "wood", Angle: 0},
		{X: 800, Y: 370, W: 280, H: 36, Material: "grass", Angle: 0},
		{X: 520, Y: 565, W: 72, H: 36, Material: "bouncy", Angle: 0},
		{X: 1080, Y: 565, W: 72, H: 36, Material: "bouncy", Angle: 0},
	},
}

// AllMaps lists every playable map in the game.
var AllMaps = []MapData{
	{
		ID:               "sunlit-meadow",
		Name:             "Sunlit Meadow",
		Theme:            "meadow",
		RoundDurationSec: 75,
		Spawn:            Point{X: 160, Y: 550},
		Carrot:           Point{X: 1380, Y: 315},
		Stump:            Point{X: 250, Y: 210},
		Platforms: []PlatformData{
			{X: 220, Y: 620, W: 340, H: 48, Material: "grass", Angle: 0},
			{X: 525, Y: 545, W: 150, H: 26, Material: "wood", Angle: -0.06},
			{X: 820, Y: 590, W: 250, H: 46, Material: "grass", Angle: 0},
			{X: 1085, Y: 500, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 1340, Y: 375, W: 290, H: 46, Material: "grass", Angle: 0},
			{X: 1030, Y: 295, W: 170, H: 26, Material: "wood", Angle: 0.05},
			{X: 720, Y: 335, W: 185, H: 28, Material: "grass", Angle: 0},
			{X: 290, Y: 265, W: 280, H: 46, Material: "grass", Angle: 0},
		},
	},
	{
		ID:               "frosty-pine-ridge",
		Name:             "Frosty Pine Ridge",
		Theme:            "frost",
		RoundDurationSec: 75,
		Spawn:            Point{X: 160, Y: 580},
		Carrot:           Point{X: 1400, Y: 245},
		Stump:            Point{X: 210, Y: 145},
		Platforms: []PlatformData{
			{X: 190, Y: 650, W: 240, H: 38, Material: "stone", Angle: 0},
			{X: 410, Y: 555, W: 125, H: 22, Material: "ice", Angle: -0.06},
			{X: 650, Y: 465, W: 115, H: 22, Material: "ice", Angle: 0.04},
			{X: 900, Y: 525, W: 130, H: 24, Material: "stone", Angle: 0},
			{X: 1130, Y: 420, W: 120, H: 22, Material: "ice", Angle: -0.04},
			{X: 1390, Y: 300, W: 190, H: 30, Material: "stone", Angle: 0},
			{X: 1120, Y: 280, W: 100, H: 20, Material: "ice", Angle: 0},
			{X: 850, Y: 340, W: 110, H: 20, Material: "ice", Angle: 0.05},
			{X: 580, Y: 350, W: 100, H: 20, Material: "ice", Angle: 0},
			{X: 340, Y: 350, W: 110, H: 22, Material: "stone", Angle: 0},
		},
	},
	{
		ID:               "mushroom-cavern",
		Name:             "Mushroom Cavern",
		Theme:            "cavern",
		RoundDurationSec: 75,
		Spawn:            Point{X: 150, Y: 580},
		Carrot:           Point{X: 1400, Y: 190},
		Stump:            Point{X: 210, Y: 125},
		Platforms: []PlatformData{
			{X: 180, Y: 650, W: 220, H: 38, Material: "stone", Angle: 0},
			{X: 370, Y: 550, W: 85, H: 22, Material: "stone", Angle: 0},
			{X: 570, Y: 445, W: 90, H: 28, Material: "bouncy", Angle: 0},
			{X: 770, Y: 340, W: 100, H: 22, Material: "stone", Angle: 0},
			{X: 970, Y: 445, W: 90, H: 28, Material: "bouncy", Angle: 0},
			{X: 1160, Y: 335, W: 100, H: 22, Material: "stone", Angle: 0},
			{X: 1400, Y: 245, W: 190, H: 30, Material: "stone", Angle: 0},
			{X: 1180, Y: 205, W: 85, H: 20, Material: "stone", Angle: 0},
			{X: 950, Y: 245, W: 90, H: 22, Material: "bouncy", Angle: 0},
			{X: 720, Y: 180, W: 100, H: 22, Material: "stone", Angle: 0},
			{X: 470, Y: 260, W: 85, H: 22, Material: "bouncy", Angle: 0},
			{X: 300, Y: 350, W: 100, H: 22, Material: "stone", Angle: 0},
		},
	},
	{
		ID:               "twilight-hollow",
		Name:             "Twilight Hollow",
		Theme:            "twilight",
		RoundDurationSec: 90,
		Spawn:            Point{X: 120, Y: 620},
		Carrot:           Point{X: 1430, Y: 165},
		Stump:            Point{X: 180, Y: 110},
		Platforms: []PlatformData{
			{X: 140, Y: 690, W: 160, H: 30, Material: "stone", Angle: 0},
			{X: 300, Y: 575, W: 75, H: 18, Material: "wood", Angle: 0.04},
			{X: 470, Y: 475, W: 70, H: 18, Material: "stone", Angle: -0.05},
			{X: 640, Y: 565, W: 75, H: 18, Material: "wood", Angle: 0},
			{X: 810, Y: 430, W: 65, H: 18, Material: "stone", Angle: 0.05},
			{X: 980, Y: 330, W: 70, H: 18, Material: "wood", Angle: 0},
			{X: 1150, Y: 420, W: 65, H: 18, Material: "stone", Angle: -0.04},
			{X: 1320, Y: 300, W: 75, H: 18, Material: "wood", Angle: 0},
			{X: 1450, Y: 210, W: 180, H: 28, Material: "stone", Angle: 0},
			{X: 1220, Y: 185, W: 65, H: 18, Material: "stone", Angle: 0},
			{X: 1020, Y: 120, W: 65, H: 18, Material: "wood", Angle: 0},
			{X: 800, Y: 220, W: 65, H: 18, Material: "stone", Angle: 0},
			{X: 580, Y: 135, W: 65, H: 18, Material: "wood", Angle: 0},
			{X: 380, Y: 240, W: 75, H: 18, Material: "stone", Angle: 0},
		},
	},
}

// PickRandomMap chooses a random map, avoiding previousID when multiple maps exist.
func PickRandomMap(previousID string) MapData {
	if len(AllMaps) == 1 {
		return AllMaps[0]
	}

	candidates := make([]MapData, 0, len(AllMaps))
	for _, m := range AllMaps {
		if m.ID != previousID {
			candidates = append(candidates, m)
		}
	}
	if len(candidates) == 0 {
		candidates = AllMaps
	}

	return candidates[rand.IntN(len(candidates))]
}
