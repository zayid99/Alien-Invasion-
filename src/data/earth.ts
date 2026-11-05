// The real world: game regions (groups of countries) and major cities.
// Countries are assigned to the nearest region centre; a few are pinned by name below.

export type Biome = 'temperate' | 'desert' | 'tropical' | 'cold';
export interface Region { id: string; name: string; continent: string; lat: number; lon: number; biome: Biome; tier: 1 | 2 | 3 | 4 }
export interface City { id: string; name: string; country: string; region: string; lat: number; lon: number; size: 2 | 3 | 4 | 5 }

// tier = when the region unlocks (1 = start, 4 = late game)
export const REGIONS: Region[] = [
  { id: 'canada', name: 'Canada', continent: 'North America', lat: 57, lon: -100, biome: 'cold', tier: 1 },
  { id: 'us-west', name: 'US West', continent: 'North America', lat: 40, lon: -116, biome: 'desert', tier: 1 },
  { id: 'us-midwest', name: 'US Midwest', continent: 'North America', lat: 41, lon: -94, biome: 'temperate', tier: 1 },
  { id: 'us-south', name: 'US South', continent: 'North America', lat: 31, lon: -90, biome: 'temperate', tier: 1 },
  { id: 'us-east', name: 'US East', continent: 'North America', lat: 40, lon: -77, biome: 'temperate', tier: 1 },
  { id: 'mexico', name: 'Mexico', continent: 'North America', lat: 23, lon: -102, biome: 'desert', tier: 1 },
  { id: 'central-america', name: 'Central America & Caribbean', continent: 'South America', lat: 15, lon: -84, biome: 'tropical', tier: 2 },
  { id: 'andes', name: 'Andes', continent: 'South America', lat: -6, lon: -75, biome: 'tropical', tier: 2 },
  { id: 'brazil', name: 'Brazil', continent: 'South America', lat: -11, lon: -50, biome: 'tropical', tier: 2 },
  { id: 'southern-cone', name: 'Southern Cone', continent: 'South America', lat: -35, lon: -64, biome: 'temperate', tier: 2 },
  { id: 'british-isles', name: 'British Isles', continent: 'Europe', lat: 54, lon: -4, biome: 'temperate', tier: 2 },
  { id: 'western-europe', name: 'Western Europe', continent: 'Europe', lat: 45, lon: 1, biome: 'temperate', tier: 2 },
  { id: 'central-europe', name: 'Central Europe', continent: 'Europe', lat: 48, lon: 14, biome: 'temperate', tier: 2 },
  { id: 'scandinavia', name: 'Scandinavia', continent: 'Europe', lat: 63, lon: 16, biome: 'cold', tier: 2 },
  { id: 'eastern-europe', name: 'Eastern Europe', continent: 'Europe', lat: 49, lon: 28, biome: 'temperate', tier: 2 },
  { id: 'russia', name: 'Russia', continent: 'Russia & Central Asia', lat: 57, lon: 46, biome: 'cold', tier: 3 },
  { id: 'siberia', name: 'Siberia', continent: 'Russia & Central Asia', lat: 63, lon: 105, biome: 'cold', tier: 3 },
  { id: 'central-asia', name: 'Central Asia', continent: 'Russia & Central Asia', lat: 43, lon: 66, biome: 'desert', tier: 3 },
  { id: 'north-africa', name: 'North Africa', continent: 'Africa', lat: 25, lon: 12, biome: 'desert', tier: 3 },
  { id: 'west-africa', name: 'West Africa', continent: 'Africa', lat: 10, lon: -2, biome: 'tropical', tier: 3 },
  { id: 'central-africa', name: 'Central Africa', continent: 'Africa', lat: 0, lon: 21, biome: 'tropical', tier: 3 },
  { id: 'east-africa', name: 'East Africa', continent: 'Africa', lat: 3, lon: 38, biome: 'tropical', tier: 3 },
  { id: 'southern-africa', name: 'Southern Africa', continent: 'Africa', lat: -24, lon: 25, biome: 'desert', tier: 3 },
  { id: 'middle-east', name: 'Middle East', continent: 'Middle East', lat: 28, lon: 47, biome: 'desert', tier: 3 },
  { id: 'south-asia', name: 'South Asia', continent: 'Asia', lat: 22, lon: 80, biome: 'tropical', tier: 4 },
  { id: 'china', name: 'China', continent: 'Asia', lat: 34, lon: 106, biome: 'temperate', tier: 4 },
  { id: 'japan-korea', name: 'Japan & Korea', continent: 'Asia', lat: 37, lon: 134, biome: 'temperate', tier: 4 },
  { id: 'southeast-asia', name: 'Southeast Asia', continent: 'Asia', lat: 8, lon: 108, biome: 'tropical', tier: 4 },
  { id: 'australia', name: 'Australia & Oceania', continent: 'Oceania', lat: -25, lon: 134, biome: 'desert', tier: 4 },
];

export const CITIES: City[] = [
  // North America
  { id: 'new-york', name: 'New York', country: 'USA', region: 'us-east', lat: 40.71, lon: -74.01, size: 5 },
  { id: 'washington', name: 'Washington', country: 'USA', region: 'us-east', lat: 38.9, lon: -77.04, size: 4 },
  { id: 'chicago', name: 'Chicago', country: 'USA', region: 'us-midwest', lat: 41.88, lon: -87.63, size: 4 },
  { id: 'kansas-city', name: 'Kansas City', country: 'USA', region: 'us-midwest', lat: 39.1, lon: -94.58, size: 2 },
  { id: 'houston', name: 'Houston', country: 'USA', region: 'us-south', lat: 29.76, lon: -95.37, size: 4 },
  { id: 'miami', name: 'Miami', country: 'USA', region: 'us-south', lat: 25.76, lon: -80.19, size: 3 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'USA', region: 'us-west', lat: 34.05, lon: -118.24, size: 5 },
  { id: 'las-vegas', name: 'Las Vegas', country: 'USA', region: 'us-west', lat: 36.17, lon: -115.14, size: 2 },
  { id: 'san-francisco', name: 'San Francisco', country: 'USA', region: 'us-west', lat: 37.77, lon: -122.42, size: 3 },
  { id: 'toronto', name: 'Toronto', country: 'Canada', region: 'canada', lat: 43.65, lon: -79.38, size: 4 },
  { id: 'vancouver', name: 'Vancouver', country: 'Canada', region: 'canada', lat: 49.28, lon: -123.12, size: 3 },
  { id: 'mexico-city', name: 'Mexico City', country: 'Mexico', region: 'mexico', lat: 19.43, lon: -99.13, size: 5 },
  // Central & South America
  { id: 'havana', name: 'Havana', country: 'Cuba', region: 'central-america', lat: 23.11, lon: -82.37, size: 3 },
  { id: 'panama-city', name: 'Panama City', country: 'Panama', region: 'central-america', lat: 8.98, lon: -79.52, size: 2 },
  { id: 'bogota', name: 'Bogotá', country: 'Colombia', region: 'andes', lat: 4.71, lon: -74.07, size: 4 },
  { id: 'lima', name: 'Lima', country: 'Peru', region: 'andes', lat: -12.05, lon: -77.04, size: 4 },
  { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', region: 'brazil', lat: -23.55, lon: -46.63, size: 5 },
  { id: 'rio', name: 'Rio de Janeiro', country: 'Brazil', region: 'brazil', lat: -22.91, lon: -43.17, size: 4 },
  { id: 'buenos-aires', name: 'Buenos Aires', country: 'Argentina', region: 'southern-cone', lat: -34.6, lon: -58.38, size: 4 },
  { id: 'santiago', name: 'Santiago', country: 'Chile', region: 'southern-cone', lat: -33.45, lon: -70.67, size: 3 },
  // Europe
  { id: 'london', name: 'London', country: 'UK', region: 'british-isles', lat: 51.51, lon: -0.13, size: 5 },
  { id: 'dublin', name: 'Dublin', country: 'Ireland', region: 'british-isles', lat: 53.35, lon: -6.26, size: 2 },
  { id: 'paris', name: 'Paris', country: 'France', region: 'western-europe', lat: 48.86, lon: 2.35, size: 5 },
  { id: 'madrid', name: 'Madrid', country: 'Spain', region: 'western-europe', lat: 40.42, lon: -3.7, size: 4 },
  { id: 'berlin', name: 'Berlin', country: 'Germany', region: 'central-europe', lat: 52.52, lon: 13.4, size: 4 },
  { id: 'rome', name: 'Rome', country: 'Italy', region: 'central-europe', lat: 41.9, lon: 12.5, size: 4 },
  { id: 'stockholm', name: 'Stockholm', country: 'Sweden', region: 'scandinavia', lat: 59.33, lon: 18.07, size: 3 },
  { id: 'warsaw', name: 'Warsaw', country: 'Poland', region: 'eastern-europe', lat: 52.23, lon: 21.01, size: 3 },
  { id: 'istanbul', name: 'Istanbul', country: 'Türkiye', region: 'eastern-europe', lat: 41.01, lon: 28.98, size: 5 },
  // Russia & Central Asia
  { id: 'moscow', name: 'Moscow', country: 'Russia', region: 'russia', lat: 55.76, lon: 37.62, size: 5 },
  { id: 'st-petersburg', name: 'Saint Petersburg', country: 'Russia', region: 'russia', lat: 59.93, lon: 30.34, size: 3 },
  { id: 'novosibirsk', name: 'Novosibirsk', country: 'Russia', region: 'siberia', lat: 55.03, lon: 82.92, size: 3 },
  { id: 'tashkent', name: 'Tashkent', country: 'Uzbekistan', region: 'central-asia', lat: 41.3, lon: 69.24, size: 3 },
  // Africa
  { id: 'cairo', name: 'Cairo', country: 'Egypt', region: 'north-africa', lat: 30.04, lon: 31.24, size: 5 },
  { id: 'casablanca', name: 'Casablanca', country: 'Morocco', region: 'north-africa', lat: 33.57, lon: -7.59, size: 3 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', region: 'west-africa', lat: 6.52, lon: 3.38, size: 5 },
  { id: 'accra', name: 'Accra', country: 'Ghana', region: 'west-africa', lat: 5.6, lon: -0.19, size: 3 },
  { id: 'kinshasa', name: 'Kinshasa', country: 'DR Congo', region: 'central-africa', lat: -4.44, lon: 15.27, size: 4 },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', region: 'east-africa', lat: -1.29, lon: 36.82, size: 4 },
  { id: 'johannesburg', name: 'Johannesburg', country: 'South Africa', region: 'southern-africa', lat: -26.2, lon: 28.05, size: 4 },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', region: 'southern-africa', lat: -33.92, lon: 18.42, size: 3 },
  // Middle East
  { id: 'dubai', name: 'Dubai', country: 'UAE', region: 'middle-east', lat: 25.2, lon: 55.27, size: 4 },
  { id: 'riyadh', name: 'Riyadh', country: 'Saudi Arabia', region: 'middle-east', lat: 24.71, lon: 46.68, size: 4 },
  { id: 'tehran', name: 'Tehran', country: 'Iran', region: 'middle-east', lat: 35.69, lon: 51.39, size: 4 },
  // Asia
  { id: 'mumbai', name: 'Mumbai', country: 'India', region: 'south-asia', lat: 19.08, lon: 72.88, size: 5 },
  { id: 'delhi', name: 'Delhi', country: 'India', region: 'south-asia', lat: 28.61, lon: 77.21, size: 5 },
  { id: 'dhaka', name: 'Dhaka', country: 'Bangladesh', region: 'south-asia', lat: 23.81, lon: 90.41, size: 5 },
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', region: 'south-asia', lat: 24.86, lon: 67.0, size: 4 },
  { id: 'beijing', name: 'Beijing', country: 'China', region: 'china', lat: 39.9, lon: 116.4, size: 5 },
  { id: 'shanghai', name: 'Shanghai', country: 'China', region: 'china', lat: 31.23, lon: 121.47, size: 5 },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China', region: 'china', lat: 22.32, lon: 114.17, size: 4 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', region: 'japan-korea', lat: 35.68, lon: 139.69, size: 5 },
  { id: 'osaka', name: 'Osaka', country: 'Japan', region: 'japan-korea', lat: 34.69, lon: 135.5, size: 4 },
  { id: 'seoul', name: 'Seoul', country: 'South Korea', region: 'japan-korea', lat: 37.57, lon: 126.98, size: 5 },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', region: 'southeast-asia', lat: 13.76, lon: 100.5, size: 4 },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', region: 'southeast-asia', lat: -6.21, lon: 106.85, size: 5 },
  { id: 'manila', name: 'Manila', country: 'Philippines', region: 'southeast-asia', lat: 14.6, lon: 120.98, size: 4 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', region: 'southeast-asia', lat: 1.35, lon: 103.82, size: 3 },
  // Oceania
  { id: 'sydney', name: 'Sydney', country: 'Australia', region: 'australia', lat: -33.87, lon: 151.21, size: 4 },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', region: 'australia', lat: -37.81, lon: 144.96, size: 3 },
];

// Countries whose centre would land them in the wrong region.
export const COUNTRY_REGION: Record<string, string> = {
  Greenland: 'canada', Iceland: 'scandinavia', Turkey: 'eastern-europe', Egypt: 'north-africa', Sudan: 'north-africa',
  Pakistan: 'south-asia', Afghanistan: 'central-asia', Mongolia: 'china', Kazakhstan: 'central-asia', Russia: 'russia',
  Indonesia: 'southeast-asia', 'Papua New Guinea': 'australia', 'New Zealand': 'australia', 'Fiji': 'australia',
  Philippines: 'southeast-asia', Madagascar: 'southern-africa', Somalia: 'east-africa', Ethiopia: 'east-africa',
  'United States of America': 'us-midwest', Canada: 'canada', Mexico: 'mexico', Brazil: 'brazil', Chile: 'southern-cone',
  Argentina: 'southern-cone', Peru: 'andes', Colombia: 'andes', Venezuela: 'andes', Ecuador: 'andes', Bolivia: 'andes',
  'United Kingdom': 'british-isles', Ireland: 'british-isles', France: 'western-europe', Spain: 'western-europe', Portugal: 'western-europe',
  Norway: 'scandinavia', Sweden: 'scandinavia', Finland: 'scandinavia', Denmark: 'central-europe', Japan: 'japan-korea',
  'South Korea': 'japan-korea', 'North Korea': 'japan-korea', China: 'china', Taiwan: 'china', India: 'south-asia', Bangladesh: 'south-asia',
  'Sri Lanka': 'south-asia', Nepal: 'south-asia', Bhutan: 'south-asia', Myanmar: 'southeast-asia', Australia: 'australia', Antarctica: '',
};
// The US is big: split it by longitude/latitude when colouring the map.
export function usRegion(lat: number, lon: number) { return lon < -104 ? 'us-west' : lon > -84 ? 'us-east' : lat < 36 ? 'us-south' : 'us-midwest'; }

export const regionById = (id: string) => REGIONS.find(r => r.id === id);
export const cityById = (id: string) => CITIES.find(c => c.id === id);
export const TIER_NAMES = ['', 'North America', 'South America & Europe', 'Africa, the Middle East & Russia', 'Asia & Oceania'];
