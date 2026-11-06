// Earth News (Phase 2): funny headlines that react to what the player did, shown on the globe ticker.
import { G } from './state';
import { pick } from '../core/util';

const FILLER = [
  'Tinfoil hat sales up 300% this week',
  'Cows refuse to leave their barns at night, farmers baffled',
  'Scientists: the green lights were "probably swamp gas"',
  'Conspiracy vlogger hits one million subscribers',
  'Pizza driver says a flying saucer "ordered extra cheese"',
  'Air force denies everything, then denies denying it',
  'Local dog has barked at the sky for six hours straight',
  'Weather balloon sales mysteriously sold out',
];
export function addNews(text: string) {
  const n = G.save.news; if (n[0] === text) return;
  n.unshift(text); if (n.length > 8) n.length = 8;
}
/** Headlines for a finished abduction night. */
export function nightNews(stats: { humans: number; animals: number; vehicles: number }, region: string, reason: string, maxAlert: number, mega: boolean) {
  if (reason === 'destroyed') addNews(`Army claims it shot down a "weather balloon" over ${region}`);
  if (mega) addNews('Witnesses describe a "giant green vacuum cleaner" in the night sky');
  if (maxAlert >= 3) addNews(`Tanks rolled through ${region} after a night of strange lights`);
  if (stats.vehicles >= 3) addNews(`${stats.vehicles} cars vanish from ${region} roads overnight. Insurers "very confused"`);
  if (stats.animals >= 4) addNews(`${region} farmers report ${stats.animals} missing animals. Police: "probably foxes"`);
  if (stats.humans >= 1) addNews(`${stats.humans} ${stats.humans === 1 ? 'person' : 'people'} missing after "weird lights" over ${region}`);
  const aw = Math.round(G.save.awareness);
  if (aw >= 15 && Math.random() < 0.4) addNews(`New poll: ${aw}% of people now believe in aliens`);
}
export function invasionNews(city: string, won: boolean) {
  if (won) { addNews(`${city} residents told to salute a giant statue of "Commander Zix"`); addNews(`BREAKING: ${city} goes silent. Officials urge everyone to stay calm`); }
  else addNews(`${city} celebrates as mysterious invaders retreat. "They'll be back," warns general`);
}
/** The ticker text: recent headlines, topped up with filler so it never runs dry. */
export function tickerLines() {
  const lines = [...G.save.news];
  for (const f of FILLER) { if (lines.length >= 6) break; if (!lines.includes(f)) lines.push(f); }
  if (lines.length < 6) lines.push(pick(FILLER));
  return lines;
}
