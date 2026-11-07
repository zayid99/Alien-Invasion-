// The Moon Base (docs/gdd/moon-base.md): the hollow moon is the Gray Empire's ship. Room list, their jobs, colours
// and where they sit on the cut face of the moon (u = sideways, v = up, in metres from the moon's centre).
export type RoomId = 'bridge' | 'research' | 'hybrid' | 'cells' | 'shipyard' | 'storage' | 'armory' | 'trophy' | 'reactor';
export interface RoomDef {
  id: RoomId; name: string; job: string;
  wall: string; floor: string; accent: string;
  /** rectangle on the cut face: [u0, u1, v0, v1] */
  rect: [number, number, number, number];
}
export const MOON = { radius: 30, crust: 2.5, roomDepth: 8 };
export const ROOMS: Record<RoomId, RoomDef> = {
  bridge:   { id: 'bridge', name: 'Command Bridge', job: 'Choose targets on Earth', wall: '#3a2f6e', floor: '#2b1b72', accent: '#9cff3f', rect: [4, 16, 11, 19] },
  research: { id: 'research', name: 'Research Lab', job: 'Invent new tech and powers', wall: '#2f5a7a', floor: '#21405a', accent: '#5fe8ff', rect: [-16, -4, 11, 19] },
  hybrid:   { id: 'hybrid', name: 'Hybrid Lab', job: 'Grow clones and hybrids', wall: '#2f6a55', floor: '#1f4a3c', accent: '#4ff0d0', rect: [4, 22, 1, 9] },
  cells:    { id: 'cells', name: 'Guest Quarters', job: 'Where abducted humans live', wall: '#6a4a7a', floor: '#4a3358', accent: '#ff6fb5', rect: [-22, -4, 1, 9] },
  shipyard: { id: 'shipyard', name: 'Shipyard', job: 'Build saucers and war machines', wall: '#4a4466', floor: '#2f2a48', accent: '#ffd23f', rect: [4, 23, -10, -1] },
  storage:  { id: 'storage', name: 'Cargo Vault', job: 'Stolen resources and artifacts', wall: '#5a4a3a', floor: '#3e3328', accent: '#ff9a3c', rect: [-23, -4, -10, -1] },
  trophy:   { id: 'trophy', name: 'Trophy Hall', job: 'Landmarks stolen from Earth', wall: '#6a5a2a', floor: '#4a3e1a', accent: '#ffd23f', rect: [4, 16, -19, -12] },
  armory:   { id: 'armory', name: 'Armory', job: 'Powers for city raids', wall: '#6a2f3a', floor: '#4a1f28', accent: '#ff5a4f', rect: [-16, -4, -19, -12] },
  reactor:  { id: 'reactor', name: 'Reactor Core', job: 'Energy for the whole moon', wall: '#1b1150', floor: '#1b1150', accent: '#a77bff', rect: [-2.5, 2.5, -20, 20] },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
