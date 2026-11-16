# Playtest report: v0.7.0

16 November 2026. Five agents worked on build `73e0761` at the same time: a new player, an economy tester, a raid
tester, a Moon Base and saves tester, and a researcher.

**How much to trust this.** The four playtesters were cut off by a usage limit before they wrote their reports, so
this report is put together from their saved logs and screenshots (about 600 raids, 120 nights, 9 Moon Base test
scripts). The new-player tester lost most of its notes; only its screenshots survive, so that part is thin. Each
finding says whether it was **confirmed in the code** or seen **in the logs only**. Everything was played by scripts in
a headless browser. No human, and no real phone, has played this build.

---

## 1. Bugs

### High

| # | Bug | Evidence |
|---|---|---|
| B1 | **Ground troops ignore the boss.** After the HQ falls the army has no target, so troops stand about 50 m from the boss and the clock runs out. A clone army 2.2 times stronger than the city ("Victory is likely") lost on time. | Confirmed in code: `armyObjective()` (`src/world/invasion.ts:312`) only knows pylons and the HQ; troops attack the boss only if it walks into their weapon range. |
| B2 | **The boss cannot fight back at range.** Its missiles are aimed at the saucer, and there is no saucer in raids, so it never fires. Its only attack is the stomp (18 m). The message on screen still says "shoot its missiles down with the ray". | Confirmed in code: `brainBoss()` (`src/world/invasion.ts:236`). |
| B3 | **Troops get stuck on building corners.** Marching from the south, 1 to 3 of every 7 walkers wedge near (±56, 55) and never fight; clones and brutes hang at the same corners for 30 to 80 seconds. Dropped on the north, east or west edge, 15 to 20 of 225 test spots trap a walker for the whole battle. | Logs only (Kansas City, New York, Tokyo, Paris, Sydney). |

### Medium

| # | Bug | Evidence |
|---|---|---|
| B4 | **Jets never hit anything.** 59 bombs dropped, none within 10 m of a troop (typical miss: 64 m). They bomb a line through the city centre, not the army. | Confirmed in code: `jetRun()` (`src/world/battle.ts:103`). |
| B5 | **Using a power before any troop lands commits you to the battle.** A Rally Beacon while scouting, then End Battle, is a defeat: the city's defense goes up by 1 and a day passes. | Confirmed in code: `castPower()` (`src/world/raid.ts:119`). |
| B6 | **Pause → Retreat while scouting counts as a defeat**, but End Battle while scouting does not. Same situation, two results. | Confirmed in code: `btn-quit` (`src/main.ts:181`). |
| B7 | **The victory report promises more tribute than the city pays.** A size-2 city is promised 2/4/2 per day and pays 1/3/1 from the first day. A new city starts with a little resistance and the amount is rounded down. | Confirmed in code: `cityTribute()` (`src/game/campaign.ts:43`), report row (`src/scenes/invasion.ts:129`). |
| B8 | **Phone, portrait (360×640): the three power cards are off the right side of the screen.** They are reachable only by scrolling the card bar, and nothing shows that it scrolls. | Logs only. |
| B9 | **Phone, landscape (844×390): the room screen's right column is 11 px off the screen**, and room names are cut off. On a very short screen (711×282) the main buttons fall below the bottom edge. | Logs only. |
| B10 | **Moon map: the Command Bridge tag is partly under the Research Lab tag.** In one desktop run a tap on "Command Bridge" opened the Research Lab. On phones, Shipyard and Cargo Vault overlap Reactor Core too. | Logs only. |
| B11 | **Slow memory leak in the Moon Base:** about 8 more textures stay in memory on every visit (98 at the start, 266 after about 20 visits). | Logs only; cause not traced. |
| B12 | **Troops can be dropped in the sea** in coastal cities (the landing zone reaches past the shoreline). | Logs only (New York, Rio, Sydney, Tokyo, San Francisco, Cairo). |

### Low

| # | Bug | Evidence |
|---|---|---|
| B13 | Timers read "1m 60s" and "60s". | Confirmed in code: `fmtTime` (`src/game/base.ts:111`). |
| B14 | An Orbital Laser fired at the shielded HQ is wasted, with no warning. | Logs only. |
| B15 | Pop-ups go stale: if research or a room upgrade finishes while its pop-up is open, the buttons stay greyed out with "the lab is busy". After starting New Game+ the "New Game+" pop-up is still open. | Logs only. |
| B16 | The ×5 button says "queue full" when 1 to 4 slots are free, and does nothing when you can afford only 1 to 4. | Logs only. |
| B17 | An error from the shader warm-up (`reading 'isReady'`) appears in the console in about one run in four. Play is not affected, but portal reviewers look at console errors. | Confirmed source: three.js `compileAsync`, called from `src/main.ts:46`. |
| B18 | A hand-damaged save (nonsense unit names in a queue) crashes the Moon Base. Normal saves from versions 3 and 4 load correctly. | Logs only. |

**What held up.** Old saves, the away-tribute card, the daily streak, New Game+, training queues (cancel, refund, finish
while in another scene), research, room upgrades, pause and resume, two raids in a row, the keyboard shortcuts, and
50 room hops with no event-listener growth. No crash was seen in normal play.

---

## 2. Balance

### 2.1 The "army power" number misleads the player

The war room compares one number for your army with one for the city. Results at defense 4, same advertised strength:

| Army | Strength vs city | Verdict shown | Won |
|---|---|---|---|
| 40 to 43 clones | 1.0 to 1.14 | An even fight | 0 of 8 |
| 24 brutes | 1.4 | Victory is likely | 0 of 3 |
| 24 brutes, level 3 | 1.85 | Victory is likely | 3 of 3 |
| 24 saucers | 1.0 | An even fight | 1 of 2 |
| 6 walkers | 0.96 | An even fight | 2 of 2, lost 1 or 2 |
| 4 walkers, level 2 | **0.74** | **Risky** | 2 of 2, lost 1 or 2 |

Walkers are worth far more than their number says and clones far less. A clone army needs about 1.8 times the city's
strength at defense 2 and above.

### 2.2 Boss cities cannot be won with a normal army

New York at defense 6, mixed armies:

| Strength vs city | Verdict shown | Won | How it ended |
|---|---|---|---|
| 1.28 | Victory is likely | 0 of 2 | time ran out, army dead |
| 1.7 | Victory is likely | 0 of 4 | time ran out, boss at 800 to 4,800 hit points |
| 2.16 | Victory is likely | 0 of 2 | 63 of 66 troops lost |
| 2.27 | Victory is likely | 2 of 2 | 51 to 62 of 72 troops lost |
| 10 walkers (1.19) | An even fight | 2 of 2 | 0 or 1 lost |

The final city (defense 7): every mixed army lost up to 2.24 times the city's strength. Twelve walkers won with 2 or 3
lost. Bugs B1 and B2 are a large part of this.

### 2.3 One strategy beats the whole game in under an hour

A bot that only builds walkers finished the campaign (New York, Paris, Cairo, Tokyo, the final city, and no other
city) in **53 to 54 minutes**: 9 or 10 nights and 5 raids. It never lost, lost 0 to 2 walkers per raid, and ended with
945 humans unspent. Nothing in the game asks for clones, brutes or saucers once walkers are affordable, and humans
have nothing to be spent on late in the game.

Walkers always earned 2 stars, not 3: they win with 40 to 58 seconds left and the third star needs 60.

### 2.4 The first raid is late and easy to lose

- Bots reached the first raid after 3 to 5 nights: **12 to 18 minutes** of play. Portal sessions are short; many
  players will leave before they see the headline feature.
- With "An even fight" on screen, 20 clones won 1 of 3 and the saucer-first build lost 2 of 3.
- The new-player tester followed the game's own guidance, raided Kansas City with 12 troops and was wiped out in 88
  seconds (screenshot: `desk_34_raid1_defeat.png`).

A first raid that ends in defeat is the most likely place to lose a new player for good.

### 2.5 Night income grows about ten times, costs do not

| Saucer upgrades | Resources per night |
|---|---|
| None | 47 to 74 |
| All level 2 | 230 to 350 |
| All level 4 | 400 to 730 |

A clone costs 10 biomass at every stage. By the middle of the game resources stop mattering. Site twists work as
designed (County Fair doubles biomass; Quiet Night pays least).

### 2.6 Occupation

- Calm your cities and they pay about 70 % of what is advertised. Ignore them and every city is in revolt by day 40,
  paying nothing. This works.
- Garrison size made no difference below 12 cities (2 troops held as well as 6), so the choice is empty early on.
- Above 40 cities a garrison of 2 cannot hold even with calming (13 of 40 in revolt).

### 2.7 Powers

Orbital Laser and EMP decide close fights: a mixed army at 1.3 times the city's strength wins most raids with powers
and about half without. Landing from the south is clearly the best side; north and split landings lose more often
(partly bug B3).

---

## 3. Does the game have what makes games hard to put down?

From the researcher's notes (`self-determination theory`, flow, the Hook model, game-feel studies, and the CrazyGames
and Poki developer guides). **Limit:** the researcher could read sources only through search extracts, not full pages.

| What the research says players need | In the game? | Why |
|---|---|---|
| Clear goals and instant feedback | **Yes** | Night goal, score and stars; raid objective line; chapter goal in the Bridge. |
| A short loop you can repeat ("one more go", about 3 minutes) | **Yes** | Nights are 150 s, raids 180 s. |
| Feeling skilled: wins come from your choices | **Partly** | True at night. In raids the power number lies (2.1) and one unit wins everything (2.3), so choices do not feel like skill. |
| Challenge that matches skill | **Partly** | Difficulty rises with the day count, not with how well you play. |
| Freedom to choose | **Partly** | Many targets and army mixes on paper; in practice one best answer. |
| Quick start and gentle teaching | **Partly** | You are in a night within seconds (good). Then a 7-step Moon Base tutorial; raids are taught by one line of text. |
| Long-term progress and things to collect | **Partly** | Rooms and troops stop at level 5. Raid stars are not saved. Achievements show no progress bars. |
| Surprise rewards | **Partly** | Site twists and supply drops; raids always pay the same. |
| Reasons to come back | **Partly** | Away tribute, daily challenge and streak exist. The streak resets after one missed day, which punishes absence. |
| Satisfying feel ("juice") | **Partly** | Strong at night (combos, MEGA BEAM). Raids are flat: no pause on a big hit, no rising sound on a streak. |
| Other people (friends, leaderboards) | **No** | Nothing. Blocked on the CrazyGames leaderboard invite. |
| Measurement | **No** | No funnel events, so nobody can see where players leave. |

### What the research says not to add

Loot boxes or gacha; long timers that can be skipped with money or an ad; penalties for being away; ads that sell
relief from a loss; staged near-misses; guilt mechanics. Studies link these to compulsive play and worse well-being,
and portals for a young audience reject them. One existing feature crosses the line: the **"Recover lost cargo"
rewarded ad** (`src/ui/rewards.ts`) sells relief from a loss.

### CrazyGames note

For games that start Basic Launch on or after 23 November 2026, click-through rate on the cover becomes a fourth
launch metric. The covers and preview video still show the old look.

---

## 4. Recommended order of work

1. **Fix the boss fight** (B1, B2): troops march on the boss, the boss shoots at troops, correct the message. Small.
2. **Make the first raid a guided, certain win**, and bring it earlier (after the first or second night). Small to medium.
3. **Make the war room honest**: re-rate each unit from simulated results, so "Victory is likely" is true. Then
   rebalance walkers against clones and brutes so mixed armies matter. Medium; needs your decisions on unit roles.
4. **Fix movement and Earth's air force** (B3, B4, B12): troops stop getting stuck, jets bomb the army, no landing in
   the sea. Medium.
5. **Fix the phone layouts** (B8, B9, B10). Small.
6. **Small bugs in one batch** (B5 to B7, B11, B13 to B18). Small.
7. **Add what is missing for retention**: save best stars per city with replays, funnel events, a streak that
   forgives one missed day, raid feel (hit pause, rising sound), then leaderboards when the invite arrives. Replace
   the "Recover lost cargo" ad with a bonus-style reward.

Raw logs and screenshots are in the session scratchpad and are not kept in the repository.
