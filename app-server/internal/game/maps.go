package game

const (
	WorldWidth  = 1600.0
	WorldHeight = 800.0
)

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Platform struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	W        float64 `json:"w"`
	H        float64 `json:"h"`
	Material string  `json:"material"`
	Angle    float64 `json:"angle"`
}

type MapDef struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Theme            string     `json:"theme"`
	RoundDurationSec int        `json:"roundDurationSec"`
	Spawn            Point      `json:"spawn"`
	Carrot           Point      `json:"carrot"`
	Stump            Point      `json:"stump"`
	Platforms        []Platform `json:"platforms"`
}

var Maps = []MapDef{
	{
		ID:               "sunlit-meadow",
		Name:             "Sunlit Meadow",
		Theme:            "meadow",
		RoundDurationSec: 75,
		Spawn:            Point{X: 160, Y: 550},
		Carrot:           Point{X: 1380, Y: 315},
		Stump:            Point{X: 250, Y: 210},
		Platforms: []Platform{
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
		ID:               "frosty-ridge",
		Name:             "Frosty Pine Ridge",
		Theme:            "frost",
		RoundDurationSec: 75,
		Spawn:            Point{X: 150, Y: 540},
		Carrot:           Point{X: 1410, Y: 500},
		Stump:            Point{X: 210, Y: 190},
		Platforms: []Platform{
			{X: 210, Y: 610, W: 300, H: 46, Material: "ice", Angle: 0},
			{X: 515, Y: 645, W: 230, H: 36, Material: "ice", Angle: 0.12},
			{X: 790, Y: 600, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 1060, Y: 585, W: 220, H: 40, Material: "ice", Angle: 0},
			{X: 1380, Y: 560, W: 260, H: 46, Material: "grass", Angle: 0},
			{X: 1340, Y: 360, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 1040, Y: 270, W: 220, H: 28, Material: "ice", Angle: -0.05},
			{X: 690, Y: 295, W: 190, H: 28, Material: "wood", Angle: 0},
			{X: 250, Y: 245, W: 270, H: 46, Material: "ice", Angle: 0},
		},
	},
	{
		ID:               "mushroom-cavern",
		Name:             "Mushroom Cavern",
		Theme:            "cavern",
		RoundDurationSec: 80,
		Spawn:            Point{X: 800, Y: 635},
		Carrot:           Point{X: 1410, Y: 215},
		Stump:            Point{X: 195, Y: 215},
		Platforms: []Platform{
			{X: 800, Y: 700, W: 360, H: 46, Material: "stone", Angle: 0},
			{X: 1080, Y: 620, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 520, Y: 620, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 1290, Y: 495, W: 210, H: 32, Material: "stone", Angle: 0},
			{X: 1020, Y: 400, W: 170, H: 26, Material: "wood", Angle: -0.08},
			{X: 1210, Y: 325, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 1400, Y: 270, W: 250, H: 42, Material: "stone", Angle: 0},
			{X: 800, Y: 310, W: 220, H: 30, Material: "stone", Angle: 0},
			{X: 510, Y: 350, W: 170, H: 26, Material: "wood", Angle: 0.08},
			{X: 210, Y: 270, W: 260, H: 42, Material: "stone", Angle: 0},
		},
	},
	{
		ID:               "twilight-hollow",
		Name:             "Twilight Hollow",
		Theme:            "twilight",
		RoundDurationSec: 80,
		Spawn:            Point{X: 170, Y: 470},
		Carrot:           Point{X: 1430, Y: 470},
		Stump:            Point{X: 800, Y: 175},
		Platforms: []Platform{
			{X: 200, Y: 540, W: 260, H: 44, Material: "grass", Angle: 0},
			{X: 470, Y: 585, W: 150, H: 26, Material: "wood", Angle: 0.1},
			{X: 800, Y: 625, W: 210, H: 36, Material: "grass", Angle: 0},
			{X: 1130, Y: 585, W: 150, H: 26, Material: "wood", Angle: -0.1},
			{X: 1400, Y: 540, W: 260, H: 44, Material: "grass", Angle: 0},
			{X: 1240, Y: 380, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 360, Y: 380, W: 72, H: 36, Material: "bouncy", Angle: 0},
			{X: 800, Y: 230, W: 280, H: 44, Material: "grass", Angle: 0},
		},
	},
}
