// "Moonlit Toybox" palette (docs/ART_STYLE.md §2), shared by every 3D builder.
// Plain sRGB hex strings: pass them to Kit.add(), THREE.Color.set() or canvas fillStyle as they are.
// The UI tokens live in style.css; the ones that also appear in 3D are repeated here.

export const PAL = {
  // ---- core tokens (same values as the CSS custom properties) ----
  ink: '#1a1033',            // the one outline / hard-shadow colour, 3D ink hulls included
  grape950: '#0f0828', grape900: '#1b1150', grape700: '#2b1b72', grape600: '#3a2696', grape400: '#5a3cc0',
  violet: '#a77bff',         // Empire tech
  violetHot: '#e2d2ff', violetDeep: '#6a3fe0', violetShade: '#4b2bb0',
  slime: '#9cff3f',          // alien signature (beam, underglow, rings, occupied territory)
  slimeDeep: '#4fbf1a', slimeCore: '#eaffd0',
  poster: '#ffd23f', posterDeep: '#e09a00',
  tomato: '#ff5a4f', tomatoDeep: '#c43a30',
  bubblegum: '#ff6fb5', mint: '#4ff0d0',
  earthCyan: '#5fe8ff',      // Earth defence tech
  earthOrange: '#ff9a3c',    // Earth weapons fire (never alien)
  cream: '#fff6e0',
  rHumans: '#ffb38a', rBiomass: '#c6f04a', rMetal: '#7fd6ff',

  // ---- 3D colours ----
  moonKey: '#d6e4ff', hemiSky: '#8f7dff', hemiGround: '#2b1f4f',
  grass: '#3f8a3a', grassBlotches: ['#468c40', '#326b32', '#4f9a45', '#2f6230'], pasture: '#55a043',
  road: '#3d3a5c', laneDash: '#ffd23f',
  walls: ['#ffe3b8', '#c8e6ff', '#ffd0dc', '#d8f0c0', '#f0e6ff'],
  roofs: ['#e0533d', '#3d7be0', '#2fb38a', '#8f5bff'],
  barn: '#e0402f', barnTrim: '#fff3e0', barnRoof: '#4a3f6b',
  windowLit: '#ffcf5c', windowDark: '#3a3f6e', door: '#8a4a2a', chimney: '#8a5a4a',
  alienSkin: '#bcc4e0', alienEye: '#0b0620', alienMouth: '#3a2f5a',
  saucerHull: '#d9def0', saucerRim: '#a77bff', saucerUnder: '#4b3a8f', saucerPanel: '#b8bedc', saucerCollar: '#6a3fe0',
  domeGlass: '#8ff4ff',
  toyArmy: '#6f9a3f', toyArmyHelmet: '#4f7a2c', tankBody: '#77a843', tankTracks: '#3a3550',
  smoke: ['#fff6e0', '#ffd23f', '#ff9a3c', '#9b8fc8'],  // puff colour over life
  snowGround: '#b9c8ea', snowBlotches: ['#c9d6f2', '#a9b9e0', '#d6e0f6', '#9fb0da'], snowRoad: '#4a4466',
  ocean: '#2a7fd6', oceanPole: '#1f5fb0', coastHalo: '#7fd0ff',
  land: '#6cc24a', landDesert: '#f0c060', landTropical: '#2fb35a', landCold: '#eef4ff', landAntarctica: '#f4f8ff',
  fence: '#b07a4a', streetPole: '#4a4466', streetHead: '#fff0b0',

  // ---- toon rim colours per scene (§4, setRimColor) ----
  rimMission: '#8f7dff', rimSnow: '#a8c8ff', rimSpace: '#7fd6ff',

  // ---- glTF tints (§5) ----
  treeLeaf: '#4fae4a', treeAutumn: '#ff8a3a', treeSnowPine: '#2e6b5a',
};

/** Sky and fog per scene (§4 "Sky and fog"): gradientSky top / horizon / bottom, FogExp2 colour and density. */
export interface SkyDef { top: number; horizon: number; bottom: number; fog: number; density: number }
export const SKY: Record<'temperate' | 'desert' | 'tropical' | 'cold' | 'city' | 'space', SkyDef> = {
  temperate: { top: 0x1b1150, horizon: 0x5a3cc0, bottom: 0x120a35, fog: 0x3a2a7a, density: 0.0036 },
  desert: { top: 0x241048, horizon: 0xa0509a, bottom: 0x1a0c30, fog: 0x4a2a6e, density: 0.0034 },
  tropical: { top: 0x0e1a52, horizon: 0x2f86b8, bottom: 0x0a1430, fog: 0x1f4a7a, density: 0.0036 },
  cold: { top: 0x17215e, horizon: 0x6a8ee0, bottom: 0x101840, fog: 0x4a5f9f, density: 0.0032 },
  city: { top: 0x1a0f4a, horizon: 0x7a3fb0, bottom: 0x120a35, fog: 0x2e1d63, density: 0.0032 },
  space: { top: 0x1a0f4a, horizon: 0x2b1670, bottom: 0x0f0828, fog: 0x0f0828, density: 0 },   // globe / mothership (no fog)
};
