// The Moon Base (docs/gdd/moon-base.md): the hollow moon is the Gray Empire's ship. Room list, their jobs, colours
// and where they sit in the wedge cutaway: `side` 1 = right face, -1 = left face; `band` 0 (top) to 3 (bottom).
export type RoomId = 'bridge' | 'research' | 'hybrid' | 'cells' | 'shipyard' | 'storage' | 'armory' | 'trophy' | 'reactor';
export interface RoomDef { id: RoomId; name: string; job: string; wall: string; floor: string; accent: string; side: 1 | -1; band: number }
/**
 * radius = the moon, crust = rim thickness, arc = how far out the rooms reach (their outer wall follows it),
 * core = gap kept around the reactor shaft, depth = how deep the rooms go into the moon,
 * bands = floor and ceiling heights of the four storeys.
 */
export const MOON = { radius: 30, crust: 2.5, arc: 26.4, core: 3.6, depth: 10, bands: [[13.5, 22.5], [1.2, 12.3], [-11.1, 0], [-21.5, -12.3]] as [number, number][] };
export const ROOMS: Record<RoomId, RoomDef> = {
  bridge:   { id: 'bridge', name: 'Command Bridge', job: 'Choose targets on Earth', wall: '#3a2f6e', floor: '#2b1b72', accent: '#9cff3f', side: 1, band: 0 },
  research: { id: 'research', name: 'Research Lab', job: 'Invent new tech and powers', wall: '#2f5a7a', floor: '#21405a', accent: '#5fe8ff', side: -1, band: 0 },
  hybrid:   { id: 'hybrid', name: 'Hybrid Lab', job: 'Grow clones and hybrids', wall: '#2f6a55', floor: '#1f4a3c', accent: '#4ff0d0', side: 1, band: 1 },
  cells:    { id: 'cells', name: 'Guest Quarters', job: 'Where abducted humans live', wall: '#6a4a7a', floor: '#4a3358', accent: '#ff6fb5', side: -1, band: 1 },
  shipyard: { id: 'shipyard', name: 'Shipyard', job: 'Build saucers and war machines', wall: '#4a4466', floor: '#2f2a48', accent: '#ffd23f', side: 1, band: 2 },
  storage:  { id: 'storage', name: 'Cargo Vault', job: 'Stolen resources and artifacts', wall: '#5a4a3a', floor: '#3e3328', accent: '#ff9a3c', side: -1, band: 2 },
  trophy:   { id: 'trophy', name: 'Trophy Hall', job: 'Landmarks stolen from Earth', wall: '#6a5a2a', floor: '#4a3e1a', accent: '#ffd23f', side: 1, band: 3 },
  armory:   { id: 'armory', name: 'Armory', job: 'Powers for city raids', wall: '#6a2f3a', floor: '#4a1f28', accent: '#ff5a4f', side: -1, band: 3 },
  reactor:  { id: 'reactor', name: 'Reactor Core', job: 'Energy for the whole moon', wall: '#1b1150', floor: '#1b1150', accent: '#a77bff', side: 1, band: -1 },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
