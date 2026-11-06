// City identity: every invasion city gets an architecture style (by region), a landmark and a coastline flag.
// The builders live in world/maps/cityStyle.ts.

export type BuildingKind = 'tower' | 'glass' | 'old' | 'slab' | 'dome' | 'pagoda' | 'colorful';
export type StyleKey = 'na' | 'latam' | 'euro' | 'soviet' | 'mideast' | 'gulf' | 'africa' | 'southasia' | 'eastasia' | 'sea' | 'oceania';
export type Landmark =
  | 'liberty' | 'capitol' | 'supertall' | 'tvtower' | 'rocket' | 'lighthouse' | 'observatory' | 'neon' | 'bridge' | 'needle'
  | 'pyramid' | 'cathedral' | 'christ' | 'obelisk' | 'clocktower' | 'eiffel' | 'gate' | 'colosseum' | 'mosque' | 'onion'
  | 'pyramids' | 'mesa' | 'burj' | 'parliament' | 'temple' | 'pearl' | 'redtower' | 'castle' | 'stupa' | 'monas' | 'marina'
  | 'opera' | 'ferris';

export interface CityStyle {
  mix: Partial<Record<BuildingKind, number>>;   // relative weights of building kinds
  walls: string[]; roofs: string[]; accents: string[];   // wall tints, roof colours, domes / signs / trims
  height: number;                                // tower height multiplier
  block: string; sidewalk: string; plaza: string; park: string; lane: string;   // ground paint
  trees: string[];                               // model ids for parks and lots
  neon: number;                                  // chance of glowing signs on a building
}
export const STYLES: Record<StyleKey, CityStyle> = {
  na: { mix: { glass: 4, tower: 4, old: 1 }, walls: ['#a0d8ff', '#c8d0e8', '#eef0ff', '#ffe08a', '#9fe8c8', '#ffb8a0'], roofs: ['#5a5f80', '#3a3550'], accents: ['#ff5a4f', '#5fe8ff', '#ffd23f'],
    height: 1.3, block: '#8a86a8', sidewalk: '#b8b4d0', plaza: '#a29ec0', park: '#4f9a45', lane: '#ffd23f', trees: ['tree_oak', 'tree_fat', 'tree_pine'], neon: 0.2 },
  latam: { mix: { colorful: 5, tower: 2, old: 2, glass: 1 }, walls: ['#ff8fb0', '#ffd23f', '#4ff0d0', '#ff9a3c', '#c8a8ff', '#fff0d0', '#9fe8c8'], roofs: ['#d8573a', '#c4502e', '#a8402a'], accents: ['#2fb38a', '#ff5a4f', '#3d7be0'],
    height: 0.85, block: '#b89482', sidewalk: '#d8c0a8', plaza: '#c8a890', park: '#5aa043', lane: '#fff6e0', trees: ['tree_palm', 'tree_fat', 'tree_palm'], neon: 0.1 },
  euro: { mix: { old: 7, tower: 1, glass: 1 }, walls: ['#fff0d0', '#ffe3b8', '#d8e8ff', '#f0d0c0', '#e8e0ff', '#d8f0c0'], roofs: ['#c4502e', '#5a5f80', '#3d6b8a', '#8a5a4a'], accents: ['#2f8a7a', '#ffd23f', '#c4502e'],
    height: 0.75, block: '#a49cb4', sidewalk: '#c8c0d4', plaza: '#b4acc4', park: '#4f9a45', lane: '#f0f0f0', trees: ['tree_oak', 'tree_autumn', 'tree_fat'], neon: 0.05 },
  soviet: { mix: { slab: 5, old: 1, tower: 1 }, walls: ['#d8d0c0', '#c0c8d0', '#e8dcc8', '#b8c0a8', '#e0c8c0'], roofs: ['#5a5f80', '#3d6b8a'], accents: ['#ff5a4f', '#2fb38a', '#ffd23f'],
    height: 0.9, block: '#9a98a8', sidewalk: '#bcbac8', plaza: '#aaa8b8', park: '#4a8a48', lane: '#f0f0f0', trees: ['tree_pine', 'tree_pine_tall', 'tree_oak'], neon: 0.05 },
  mideast: { mix: { dome: 6, colorful: 1, tower: 1 }, walls: ['#f0dcb0', '#e8c890', '#fff0d8', '#d8b888', '#f8e4c4'], roofs: ['#c8a070', '#a88860'], accents: ['#3d9be8', '#e8c86a', '#2fb38a'],
    height: 0.7, block: '#d4bc94', sidewalk: '#e4d0ac', plaza: '#dcc4a0', park: '#8aa04a', lane: '#fff6e0', trees: ['tree_palm', 'tree_palm', 'cactus'], neon: 0.08 },
  gulf: { mix: { glass: 6, dome: 3, tower: 1 }, walls: ['#f0dcb0', '#a0d8ff', '#e8f4ff', '#d8b888'], roofs: ['#c8a070'], accents: ['#e8c86a', '#5fe8ff', '#3d9be8'],
    height: 1.7, block: '#d8c8a0', sidewalk: '#e8dcbc', plaza: '#e0d0ac', park: '#7aa84a', lane: '#ffd23f', trees: ['tree_palm'], neon: 0.25 },
  africa: { mix: { colorful: 4, tower: 2, dome: 1, old: 1 }, walls: ['#ff9a3c', '#ffd23f', '#9fe8c8', '#ff8fb0', '#d8b888', '#fff0d0'], roofs: ['#8a90b8', '#c4502e', '#3d7be0', '#2fb38a'], accents: ['#2fb38a', '#ffd23f', '#ff5a4f'],
    height: 0.85, block: '#c08a70', sidewalk: '#d8a890', plaza: '#cc9a80', park: '#6aa043', lane: '#fff6e0', trees: ['tree_palm', 'tree_fat'], neon: 0.08 },
  southasia: { mix: { colorful: 6, tower: 2, dome: 1 }, walls: ['#ffd0dc', '#ffd23f', '#4ff0d0', '#ff9a3c', '#c8a8ff', '#fff0d0', '#9fe8c8', '#ff8fb0'], roofs: ['#c4502e', '#8a90b8'], accents: ['#ff5a4f', '#2fb38a', '#ffd23f', '#ff6fb5'],
    height: 0.9, block: '#b8a090', sidewalk: '#d0bcac', plaza: '#c4ae9c', park: '#5aa043', lane: '#fff6e0', trees: ['tree_palm', 'tree_fat'], neon: 0.25 },
  eastasia: { mix: { glass: 4, tower: 3, pagoda: 2 }, walls: ['#eef0ff', '#a0d8ff', '#ffe0e8', '#c8d0e8', '#d8f0e8'], roofs: ['#c4302e', '#2f8a7a', '#3a3550'], accents: ['#ff6fb5', '#5fe8ff', '#ffd23f', '#ff5a4f'],
    height: 1.45, block: '#8a8ab0', sidewalk: '#b4b4d0', plaza: '#a0a0c0', park: '#4f9a45', lane: '#f0f0f0', trees: ['tree_oak', 'tree_pine', 'tree_autumn'], neon: 0.45 },
  sea: { mix: { tower: 3, glass: 2, colorful: 3, pagoda: 1 }, walls: ['#fff0d0', '#a0d8ff', '#ffd0dc', '#9fe8c8', '#ffe08a'], roofs: ['#c4502e', '#2fb38a'], accents: ['#ff6fb5', '#ffd23f', '#5fe8ff'],
    height: 1.15, block: '#9aa890', sidewalk: '#bcc8b4', plaza: '#aab8a0', park: '#4fa045', lane: '#fff6e0', trees: ['tree_palm', 'tree_fat'], neon: 0.3 },
  oceania: { mix: { glass: 3, tower: 2, old: 2, colorful: 1 }, walls: ['#eef0ff', '#a0d8ff', '#fff0d0', '#ffe3b8', '#d8f0c0'], roofs: ['#c4502e', '#5a5f80'], accents: ['#ffd23f', '#5fe8ff'],
    height: 1.1, block: '#a8a8b8', sidewalk: '#c8c8d4', plaza: '#b8b8c8', park: '#5aa043', lane: '#ffd23f', trees: ['tree_palm', 'tree_oak'], neon: 0.12 },
};
export const REGION_STYLE: Record<string, StyleKey> = {
  'us-east': 'na', 'us-west': 'na', 'us-midwest': 'na', 'us-south': 'na', canada: 'na',
  mexico: 'latam', 'central-america': 'latam', andes: 'latam', brazil: 'latam', 'southern-cone': 'latam',
  'british-isles': 'euro', 'western-europe': 'euro', 'central-europe': 'euro', scandinavia: 'euro', 'eastern-europe': 'euro',
  russia: 'soviet', siberia: 'soviet', 'central-asia': 'soviet',
  'north-africa': 'mideast', 'west-africa': 'africa', 'central-africa': 'africa', 'east-africa': 'africa', 'southern-africa': 'africa',
  'middle-east': 'gulf', 'south-asia': 'southasia', china: 'eastasia', 'japan-korea': 'eastasia', 'southeast-asia': 'sea', australia: 'oceania',
};
/** Per-city landmark, coastline and optional style override. Cities not listed get their style's default landmark. */
export const CITY_LOOK: Record<string, { landmark: Landmark; coast?: boolean; style?: StyleKey }> = {
  'new-york': { landmark: 'liberty', coast: true }, washington: { landmark: 'capitol' }, chicago: { landmark: 'supertall', coast: true },
  'kansas-city': { landmark: 'tvtower' }, houston: { landmark: 'rocket' }, miami: { landmark: 'lighthouse', coast: true },
  'los-angeles': { landmark: 'observatory', coast: true }, 'las-vegas': { landmark: 'neon' }, 'san-francisco': { landmark: 'bridge', coast: true },
  toronto: { landmark: 'needle', coast: true }, vancouver: { landmark: 'marina', coast: true },
  'mexico-city': { landmark: 'pyramid' }, havana: { landmark: 'capitol', coast: true }, 'panama-city': { landmark: 'supertall', coast: true },
  bogota: { landmark: 'cathedral' }, lima: { landmark: 'cathedral', coast: true }, 'sao-paulo': { landmark: 'supertall' }, rio: { landmark: 'christ', coast: true },
  'buenos-aires': { landmark: 'obelisk', coast: true }, santiago: { landmark: 'supertall' },
  london: { landmark: 'clocktower' }, dublin: { landmark: 'obelisk', coast: true }, paris: { landmark: 'eiffel' }, madrid: { landmark: 'gate' },
  berlin: { landmark: 'tvtower' }, rome: { landmark: 'colosseum' }, stockholm: { landmark: 'clocktower', coast: true }, warsaw: { landmark: 'cathedral' },
  istanbul: { landmark: 'mosque', coast: true, style: 'mideast' }, moscow: { landmark: 'onion' }, 'st-petersburg': { landmark: 'onion', coast: true },
  novosibirsk: { landmark: 'cathedral' }, tashkent: { landmark: 'mosque', style: 'mideast' },
  cairo: { landmark: 'pyramids' }, casablanca: { landmark: 'mosque', coast: true }, lagos: { landmark: 'gate', coast: true }, accra: { landmark: 'gate', coast: true },
  kinshasa: { landmark: 'tvtower' }, nairobi: { landmark: 'needle' }, johannesburg: { landmark: 'tvtower' }, 'cape-town': { landmark: 'mesa', coast: true },
  dubai: { landmark: 'burj', coast: true }, riyadh: { landmark: 'supertall' }, tehran: { landmark: 'gate', style: 'mideast' },
  mumbai: { landmark: 'gate', coast: true }, delhi: { landmark: 'gate' }, dhaka: { landmark: 'parliament' }, karachi: { landmark: 'mosque', coast: true },
  beijing: { landmark: 'temple' }, shanghai: { landmark: 'pearl', coast: true }, 'hong-kong': { landmark: 'supertall', coast: true },
  tokyo: { landmark: 'redtower', coast: true }, osaka: { landmark: 'castle', coast: true }, seoul: { landmark: 'tvtower' },
  bangkok: { landmark: 'stupa' }, jakarta: { landmark: 'monas', coast: true }, manila: { landmark: 'cathedral', coast: true }, singapore: { landmark: 'marina', coast: true },
  sydney: { landmark: 'opera', coast: true }, melbourne: { landmark: 'ferris' },
};
export const DEFAULT_LANDMARK: Record<StyleKey, Landmark> = {
  na: 'supertall', latam: 'cathedral', euro: 'cathedral', soviet: 'onion', mideast: 'mosque', gulf: 'burj', africa: 'gate',
  southasia: 'gate', eastasia: 'temple', sea: 'stupa', oceania: 'ferris',
};
export function cityLook(id: string, region: string) {
  const L = CITY_LOOK[id], key = L?.style || REGION_STYLE[region] || 'na';
  return { key, style: STYLES[key], landmark: L?.landmark || DEFAULT_LANDMARK[key], coast: !!L?.coast };
}
