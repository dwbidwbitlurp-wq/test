// Global world layout: every place in the kingdom of Aetheria lives here.

export const WORLD = {
  size: 2000,
  segments: 400,
  playRadius: 640,
  water: 3,
};

export const CASTLE = { x: 0, z: -260, y: 40 };
export const CRAG = { x: -400, z: -380, y: 60, r: 55 };
export const LAKE = { x: 300, z: -40, rx: 160, rz: 130 };
export const VILLAGE = { x: 260, z: 340, r: 60 };
export const CAMP = { x: -400, z: 180, r: 34 };
export const RUINS = { x: 485, z: -40 };
export const SPIRE = { x: 415, z: -70 };
export const FOREST = { x: -330, z: 60, r: 250 };
export const MEADOW = { x: 0, z: 420, r: 200 };
export const HERMIT = { x: -165, z: -30 };

export const START = { x: 18, z: 488, yaw: Math.PI };

// Roads: list of polylines. A point may force a height (h).
export const ROADS = [
  // main road: meadow -> castle gate
  [
    { x: 10, z: 520 }, { x: -6, z: 440 }, { x: -12, z: 380 }, { x: 16, z: 280 },
    { x: 12, z: 170 }, { x: -8, z: 80 }, { x: -6, z: 10 }, { x: 0, z: -50 },
    { x: 0, z: -140, h: CASTLE.y }, { x: 0, z: -186, h: CASTLE.y },
  ],
  // crossroads -> forest -> bandit camp
  [
    { x: 12, z: 170 }, { x: -110, z: 150 }, { x: -210, z: 175 },
    { x: -300, z: 160 }, { x: -372, z: 178 },
  ],
  // crossroads -> lake shore -> crystal ruins
  [
    { x: 12, z: 170 }, { x: 140, z: 170 }, { x: 250, z: 175 }, { x: 370, z: 150 },
    { x: 460, z: 90 }, { x: 490, z: 20 }, { x: 485, z: -20 },
  ],
  // meadow -> honey vale village
  [
    { x: -12, z: 380 }, { x: 90, z: 390 }, { x: 180, z: 360 }, { x: 240, z: 342 },
  ],
  // castle foot -> twilight crag
  [
    { x: -6, z: 10 }, { x: -90, z: -70 }, { x: -170, z: -150 }, { x: -250, z: -215 },
    { x: -310, z: -275 }, { x: -350, z: -320, h: CRAG.y - 10 }, { x: -385, z: -362, h: CRAG.y },
  ],
  // forest road -> hermit
  [
    { x: -110, z: 150 }, { x: -140, z: 60 }, { x: -160, z: -10 },
  ],
];

// Discoverable locations (shown on map + big title on first visit)
export const LOCATIONS = [
  { id: 'meadow', name: 'Цветущие луга', x: 0, z: 430, r: 160 },
  { id: 'castle', name: 'Люменхолд', x: CASTLE.x, z: CASTLE.z, r: 115 },
  { id: 'forest', name: 'Шепчущий лес', x: FOREST.x, z: FOREST.z, r: 220 },
  { id: 'camp', name: 'Лагерь Чёрной Лисы', x: CAMP.x, z: CAMP.z, r: 45 },
  { id: 'lake', name: 'Зеркальное озеро', x: LAKE.x, z: LAKE.z, r: 150 },
  { id: 'ruins', name: 'Хрустальные руины', x: RUINS.x, z: RUINS.z, r: 70 },
  { id: 'village', name: 'Медовый Дол', x: VILLAGE.x, z: VILLAGE.z, r: 75 },
  { id: 'crag', name: 'Сумеречный утёс', x: CRAG.x, z: CRAG.z, r: 80 },
  { id: 'hermit', name: 'Хижина отшельника', x: HERMIT.x, z: HERMIT.z, r: 25 },
];

// Altars of Light (checkpoints / fast travel)
export const ALTARS = [
  { id: 'a_meadow', name: 'Алтарь Цветущих лугов', x: 34, z: 470 },
  { id: 'a_castle', name: 'Алтарь Врат Люменхолда', x: 22, z: -120 },
  { id: 'a_forest', name: 'Алтарь Шепчущего леса', x: -230, z: 150 },
  { id: 'a_village', name: 'Алтарь Медового Дола', x: 226, z: 318 },
  { id: 'a_lake', name: 'Алтарь Зеркального озера', x: 452, z: 108 },
  { id: 'a_crag', name: 'Алтарь у подножия утёса', x: -290, z: -250 },
];

// River: spring pool on the castle plateau -> cascade down the cliff -> lake
export const RIVER = {
  upper: [{ x: 86, z: -252 }, { x: 98, z: -250 }, { x: 110, z: -248 }, { x: 118, z: -246 }],
  lower: [{ x: 128, z: -243 }, { x: 140, z: -231 }, { x: 150, z: -212 }, { x: 156, z: -190 }, { x: 162, z: -170 }, { x: 171, z: -150 }, { x: 180, z: -132 }],
  width: 7,
};

// footprints where grass & flowers must not grow (house floors, tents) — filled by structures
export const NO_GRASS = [];
export function grassBlocked(x, z) {
  for (const r of NO_GRASS) {
    const dx = x - r.x, dz = z - r.z;
    const c = Math.cos(r.ry), s = Math.sin(r.ry);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < r.hx && Math.abs(lz) < r.hz) return true;
  }
  return false;
}
