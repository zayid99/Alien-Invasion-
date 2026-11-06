// Saucer skins (Phase 2): earned by playing, never bought. Each is a palette for the hull kit in gfx/models.ts.
import { PAL } from '../gfx/palette';

export interface Skin { id: string; name: string; hull: string; under: string; rim: string; panel: string; collar: string; spots?: string; unlock: string; ach?: string }
export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', hull: PAL.saucerHull, under: PAL.saucerUnder, rim: PAL.saucerRim, panel: PAL.saucerPanel, collar: PAL.saucerCollar, unlock: 'Standard issue' },
  { id: 'moo', name: 'Moo-Saucer', hull: '#ece4d6', under: '#2a1f3f', rim: '#ff9fb0', panel: '#fff8ee', collar: '#2a1f3f', spots: '#2a1f3f', unlock: 'Beam up 25 cows', ach: 'cattle-call' },
  { id: 'midnight', name: 'Midnight Stealth', hull: '#3a2f6e', under: '#1b1150', rim: '#9cff3f', panel: '#2b1b72', collar: '#4b2bb0', unlock: 'Complete 10 nights', ach: 'night-owl' },
  { id: 'slime', name: 'Slime King', hull: '#9cff3f', under: '#4fbf1a', rim: '#2b1b72', panel: '#c6f04a', collar: '#2b1b72', unlock: 'Power up the MEGA BEAM', ach: 'mega-beam' },
  { id: 'snack', name: 'Snack Attack', hull: '#ffb84d', under: '#c4502e', rim: '#ff5a4f', panel: '#fff0b0', collar: '#7a4a2a', spots: '#d8402f', unlock: 'Find 3 Earth artifacts', ach: 'snack-attack' },
  { id: 'camo', name: 'Earth Camo', hull: '#77a843', under: '#3a3550', rim: '#5e8a34', panel: '#8cbf55', collar: '#3a3550', spots: '#4f7a2c', unlock: 'Beam up a tank', ach: 'tank-you' },
  { id: 'candy', name: 'Candy Pop', hull: '#ffd0e6', under: '#ff6fb5', rim: '#4ff0d0', panel: '#ffffff', collar: '#ff6fb5', unlock: '7-day supply streak', ach: 'loyal' },
  { id: 'golden', name: 'Golden Empire', hull: '#ffd23f', under: '#c47a00', rim: '#fff6e0', panel: '#ffe38a', collar: '#c47a00', unlock: 'Capture 5 cities', ach: 'continental' },
];
export const skinById = (id: string) => SKINS.find(s => s.id === id) || SKINS[0];
