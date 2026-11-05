// Biomes change how a mission map looks and what lives there.
// Colours follow the "Moonlit Toybox" guide (docs/ART_STYLE.md §2, §5): candy ground and crops,
// pastel house walls with candy roofs, and the §4 sky / fog row of each biome.
import type { Biome } from './earth';
import { PAL, SKY } from '../gfx/palette';
import type { SkyDef } from '../gfx/palette';

export interface BiomeDef {
  name: string;
  ground: string; blotches: string[];                 // base ground colour + noise colours (canvas, sRGB)
  fields: [string, string][];                         // crop field colours: [base, stripe]
  pasture: string; road: string; dirt: string; outer: number;
  plaza: string; base: string;                        // town square around the water tower, army-base ground
  water: string | null; shore: string;                // farm pond (null = none) and its painted shore ring
  trees: string[]; treeScale: [number, number];       // model ids from assets.ts
  extras: string[];                                   // small scenery props
  farm: string[];                                     // farm animals
  wild: string[];                                     // wild animals (models)
  sky: SkyDef;                                        // §4 "Sky and fog" row, passed to nightSky()
  houseWalls: string[]; roofs: string[];
}
export const BIOMES: Record<Biome, BiomeDef> = {
  temperate: {
    name: 'Farmland', ground: PAL.grass, blotches: PAL.grassBlotches,
    fields: [['#e8c35a', '#d4a840'], ['#5aa83f', '#478f30'], ['#a8703f', '#8f5c33']], pasture: PAL.pasture, road: PAL.road, dirt: '#b5895a', outer: 0x2f6230,
    plaza: '#8a86a8', base: '#7d8a52', water: PAL.ocean, shore: '#d9c08a',
    trees: ['tree_pine', 'tree_oak', 'tree_fat', 'tree_autumn'], treeScale: [3.2, 4.6], extras: ['bush', 'rock_small', 'stump', 'flower_red'],
    farm: ['cow', 'cow', 'sheep', 'pig', 'chicken'], wild: ['deer', 'fox'],
    sky: SKY.temperate,
    houseWalls: PAL.walls, roofs: PAL.roofs,
  },
  desert: {
    name: 'Desert', ground: '#d8a25c', blotches: ['#e2b06a', '#c99450', '#e8bb78', '#c08a48'],
    fields: [['#a8c050', '#90a842'], ['#f0c870', '#dcb058'], ['#b87a4c', '#a0683e']], pasture: '#c8b860', road: PAL.road, dirt: '#e8c088', outer: 0xb8864c,
    plaza: '#d8b0a0', base: '#b09a62', water: null, shore: '#e8c088',
    trees: ['tree_palm', 'cactus', 'cactus'], treeScale: [3.4, 5], extras: ['rock_large', 'rock_small', 'rock_tall', 'cactus'],
    farm: ['sheep', 'chicken', 'cow'], wild: ['fox'],
    sky: SKY.desert,
    houseWalls: ['#ffe3b8', '#ffd0dc', '#f0e6ff'], roofs: ['#e0533d', '#2fb38a', '#8f5bff'],
  },
  tropical: {
    name: 'Tropics', ground: '#2f9a4a', blotches: ['#36a852', '#278a40', '#40b45c', '#237a38'],
    fields: [['#7fc840', '#68b034'], ['#b0d850', '#98c040'], ['#3fae6a', '#33985a']], pasture: '#4fb84a', road: PAL.road, dirt: '#c08a5a', outer: 0x237a38,
    plaza: '#8a86a8', base: '#7d8a52', water: '#28a8d8', shore: '#f0d898',
    trees: ['tree_palm', 'tree_fat', 'tree_oak', 'tree_palm'], treeScale: [3.4, 5.2], extras: ['bush_large', 'bush', 'flower_red'],
    farm: ['pig', 'chicken', 'cow'], wild: ['deer'],
    sky: SKY.tropical,
    houseWalls: ['#d8f0c0', '#c8e6ff', '#ffd0dc', '#ffe3b8', '#f0e6ff'], roofs: ['#e0533d', '#2fb38a', '#3d7be0'],
  },
  cold: {
    name: 'Snowfields', ground: PAL.snowGround, blotches: PAL.snowBlotches,
    fields: [['#c9d6f2', '#aebee6'], ['#d6e0f6', '#bccbec'], ['#c2cff0', '#a9b9e0']], pasture: '#d0dcf6', road: PAL.snowRoad, dirt: '#9a9ac4', outer: 0x9fb0da,
    plaza: '#a6a2c4', base: '#9a9ec0', water: '#cfe0ff', shore: '#a9b9e0',
    trees: ['tree_pine_snow', 'tree_pine_tall_snow', 'tree_pine_snow'], treeScale: [3.6, 5.6], extras: ['rock_small', 'rock_large', 'stump'],
    farm: ['sheep', 'cow', 'cow'], wild: ['deer', 'fox'],
    sky: SKY.cold,
    houseWalls: ['#ffd0dc', '#c8e6ff', '#ffe3b8', '#f0e6ff', '#d8f0c0'], roofs: PAL.roofs,
  },
};
