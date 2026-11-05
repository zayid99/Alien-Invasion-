// Biomes change how a mission map looks and what lives there.
import type { Biome } from './earth';

export interface BiomeDef {
  name: string;
  ground: string; blotches: string[];                 // base ground colour + noise colours (canvas, sRGB)
  fields: [string, string][];                         // crop field colours: [base, stripe]
  pasture: string; road: string; dirt: string; outer: number;
  trees: string[]; treeScale: [number, number];       // model ids from assets.ts
  extras: string[];                                   // small scenery props
  farm: string[];                                     // farm animals
  wild: string[];                                     // wild animals (models)
  fog: number; skyTop: number; skyHorizon: number;
  houseWalls: string[]; roofs: string[];
}
export const BIOMES: Record<Biome, BiomeDef> = {
  temperate: {
    name: 'Farmland', ground: '#2e4826', blotches: ['#36552b', '#283f21', '#3b5a2c', '#2a4422'],
    fields: [['#a68d44', '#8d7536'], ['#3f6b2a', '#2f5420'], ['#5a4430', '#4a3626']], pasture: '#3e6b2e', road: '#34363d', dirt: '#6b5a3c', outer: 0x1b2a18,
    trees: ['tree_pine', 'tree_oak', 'tree_fat', 'tree_autumn'], treeScale: [3.2, 4.6], extras: ['bush', 'rock_small', 'stump', 'flower_red'],
    farm: ['cow', 'cow', 'sheep', 'pig', 'chicken'], wild: ['deer', 'fox'],
    fog: 0x0b0f24, skyTop: 0x04061a, skyHorizon: 0x2a1f5c,
    houseWalls: ['#d8cbb0', '#c9b79c', '#b8c4cf', '#e0d6c2', '#c79c84', '#a7b59a'], roofs: ['#7a3b2e', '#4a4f5c', '#5b3a29', '#3d5466'],
  },
  desert: {
    name: 'Desert', ground: '#8a7048', blotches: ['#9a7d52', '#7c6340', '#a3895c', '#806844'],
    fields: [['#7f8f3a', '#6a7a2e'], ['#a3884a', '#8c733c'], ['#6e5a3a', '#5e4c30']], pasture: '#8f8a52', road: '#3a3936', dirt: '#a08458', outer: 0x5a4a32,
    trees: ['tree_palm', 'cactus', 'cactus'], treeScale: [3.4, 5], extras: ['rock_large', 'rock_small', 'rock_tall', 'cactus'],
    farm: ['sheep', 'chicken', 'cow'], wild: ['fox'],
    fog: 0x1c1430, skyTop: 0x070820, skyHorizon: 0x4a2a5c,
    houseWalls: ['#e6d3b0', '#d9c29a', '#efe3c9', '#c9a77c'], roofs: ['#b7643a', '#9c5a3a', '#d9c29a'],
  },
  tropical: {
    name: 'Tropics', ground: '#2a5326', blotches: ['#336a2c', '#24481f', '#3d6e30', '#2b5524'],
    fields: [['#4f7a3a', '#3f6a5a'], ['#6a8f3a', '#567a2e'], ['#3f6a2a', '#2f5a22']], pasture: '#4a7d36', road: '#3a3a3a', dirt: '#7a5a3a', outer: 0x163018,
    trees: ['tree_palm', 'tree_fat', 'tree_oak', 'tree_palm'], treeScale: [3.4, 5.2], extras: ['bush_large', 'bush', 'flower_red'],
    farm: ['pig', 'chicken', 'cow'], wild: ['deer'],
    fog: 0x0a1424, skyTop: 0x040a1a, skyHorizon: 0x1f3a5c,
    houseWalls: ['#e8d36a', '#9fd6c8', '#f0b2a0', '#d8e6b0', '#c8d8f0'], roofs: ['#b7643a', '#5b3a29', '#3d6646'],
  },
  cold: {
    name: 'Snowfields', ground: '#c9d2de', blotches: ['#dfe6ef', '#b8c3d2', '#e8eef5', '#aebacc'],
    fields: [['#e3e9f1', '#c6cfdb'], ['#d6dde8', '#b9c3d1'], ['#cfd7e3', '#aeb9c8']], pasture: '#d9e1ec', road: '#4a4d55', dirt: '#8a8f99', outer: 0x8c97a8,
    trees: ['tree_pine', 'tree_pine_tall', 'tree_pine'], treeScale: [3.6, 5.6], extras: ['rock_small', 'rock_large', 'stump'],
    farm: ['sheep', 'cow', 'cow'], wild: ['deer', 'fox'],
    fog: 0x182238, skyTop: 0x050a1c, skyHorizon: 0x2c3e66,
    houseWalls: ['#9b3b30', '#3f5f7f', '#d8cbb0', '#6f7f4f'], roofs: ['#e8eef5', '#dfe6ef'],
  },
};
