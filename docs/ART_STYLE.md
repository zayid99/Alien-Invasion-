# ALIEN INVASION: Art Style Guide v2, "Moonlit Toybox"

## 1. Direction

Earth is a cel-shaded toy diorama on a bright lavender moonlit night: candy-coloured houses, chunky animals with googly eyes, plum ink outlines on everything, and shadows that turn purple, never black. Everything that belongs to the Gray Empire is lit by **lime "slime light"**: the beam, saucer underglow, mission rings, conquered territory on the globe, and the BUILD buttons. Violet is the Empire's tech colour, and only alien tech is bright enough to bloom. Earth's defences are clean white toy tech with cyan and tomato accents and orange fire. The UI is a set of chunky comic stickers: 3 px ink borders, hard offset shadows, cream speech balloons for Commander Zix, and Bangers sound-effect words (ZAP!, YOINK!, KA-BOOM!) that pop out of the action. The tone is a comedic B-movie where nobody gets hurt: stunned people see dizzy stars and soldiers wave white flags.

## 2. Palette

### UI tokens (`:root` in style.css; they replace the old tokens)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1a1033` | The single ink colour: every UI border (3 px), hard drop shadows, text on light fills, 3D outline hulls, globe borders |
| `--grape-950` | `#0f0828` | Loading/backdrop base, title scrim, space bottom |
| `--grape-900` | `#1b1150` | Meter tracks, war-room fill, sky zenith |
| `--grape-700` | `#2b1b72` | Panel bottom, HUD pill fill |
| `--grape-600` | `#3a2696` | Panel top, list rows, cards |
| `--grape-400` | `#5a3cc0` | Dividers, joystick base ring |
| `--violet` | `#a77bff` | Empire tech: shield meter, shield bubble, UPGRADE, secondary accents, eyebrows |
| `--violet-hot` | `#e2d2ff` | Light accent text on dark, h3, shield rim |
| `--violet-deep` | `#6a3fe0` | Secondary button fill, ribbons, bold words in cream balloons |
| `--violet-shade` | `#4b2bb0` | Secondary button bevel, link text on cream/yellow |
| `--slime` | `#9cff3f` | **Alien signature**: beam, UFO underglow, mission rings, occupied territory, BUILD/Launch buttons, radar, logo "ALIEN", focus ring |
| `--slime-deep` | `#4fbf1a` | Slime bevel, logo extrusion, goo rims |
| `--slime-core` | `#eaffd0` | Beam hard rings, sparkles, slime highlights |
| `--poster` | `#ffd23f` | Primary CTA, objective pill, cargo meter, selected region/pin, stun stars, `.good` toasts |
| `--poster-deep` | `#e09a00` | Primary bevel, cargo meter dark end |
| `--tomato` | `#ff5a4f` | Alarm, low shield, danger buttons, invadable cities, Earth power bar, hazard stripes, `.warn` toasts |
| `--tomato-deep` | `#c43a30` | Danger bevel |
| `--bubblegum` | `#ff6fb5` | Stun ray, ZAP bursts, running-light alt colour |
| `--mint` | `#4ff0d0` | Boost meter and touch Boost button |
| `--earth-cyan` | `#5fe8ff` | Earth defence tech: pylon rings/cores, HQ shield, atmosphere |
| `--earth-orange` | `#ff9a3c` | Earth weapons fire, explosions, sirens (never used for alien things) |
| `--cream` | `#fff6e0` | Speech balloons, tutorial card, map labels, keycaps |
| `--text` | `#f6f1ff` | Body text on grape |
| `--dim` | `#c2b6f0` | Secondary text on grape (6.8:1 on `#2b1b72`) |
| `--disabled-bg` / `--disabled-fg` | `#4a4470` / `#9d95c8` | Disabled buttons |
| `--r-humans` | `#ffb38a` | Humans resource |
| `--r-biomass` | `#c6f04a` | Biomass (yellower than slime, on purpose) |
| `--r-metal` | `#7fd6ff` | Metal |

### 3D colours (E1/E2 use them as constants in a shared `src/gfx/palette.ts`)

| Name | Hex | Use |
|---|---|---|
| moon-key | `#d6e4ff` | DirectionalLight in missions |
| hemi-sky / hemi-ground | `#8f7dff` / `#2b1f4f` | Hemisphere fill (lavender shadows) |
| grass | `#3f8a3a` | Temperate base; blotches `#468c40 #326b32 #4f9a45 #2f6230`; pasture `#55a043` |
| road | `#3d3a5c` | Asphalt everywhere; lane dashes `#ffd23f` |
| walls | `#ffe3b8 #c8e6ff #ffd0dc #d8f0c0 #f0e6ff` | House wall pastels |
| roofs | `#e0533d #3d7be0 #2fb38a #8f5bff` | House roofs |
| barn | `#e0402f` | Walls; trim `#fff3e0`; roof `#4a3f6b` |
| window-lit / window-dark | `#ffcf5c` / `#3a3f6e` | Windows (lit glow k 1.3, which never blooms) |
| alien-skin | `#bcc4e0` | Gray alien skin |
| alien-eye | `#0b0620` | Eyes (white catchlights) |
| saucer-hull | `#d9def0` | Hull; rim `#a77bff`; underside `#4b3a8f`; collar `#6a3fe0` |
| dome-glass | `#8ff4ff` | Saucer dome, opacity 0.32 |
| toy-army | `#6f9a3f` / `#4f7a2c` | Soldier uniform / helmet, tank body `#77a843`, tracks `#3a3550` |
| smoke | `#fff6e0 → #ffd23f → #ff9a3c → #9b8fc8` | Puff colour over life |
| snow ground | `#b9c8ea` | Blotches `#c9d6f2 #a9b9e0 #d6e0f6 #9fb0da`; roads `#4a4466` |
| ocean | `#2a7fd6` | Globe equator; poles `#1f5fb0`; coast halo `#7fd0ff` |
| land | `#6cc24a` | Temperate; desert `#f0c060`, tropical `#2fb35a`, cold `#eef4ff`, Antarctica `#f4f8ff` |

**HDR glow multipliers (k) for `MAT.glow`:**
- Alien parts use k 2.2–3.2, so they bloom.
- Moon and explosions use k ≥ 2.
- Earth windows use k ≤ 1.3 and street lamps k 1.3, so they do not bloom.
- Sirens and beacons use k 3, which are Earth alarms that are allowed to bloom.

## 3. Typography

One link in index.html. The same OFL woff2 files are also self-hosted in `public/fonts/` with `@font-face { font-display: swap }`, and `<link rel=preload>` loads Lilita One and Fredoka 600. The baseline screenshots render in fallback faces, so the CDN cannot be relied on.

```
https://fonts.googleapis.com/css2?family=Bangers&family=Fredoka:wght@500;600;700&family=Lilita+One&display=swap
```

| Token | Family | Fallback stack |
|---|---|---|
| `--font-display` | **Lilita One 400** | "Arial Rounded MT Bold", "Arial Black", system-ui |
| `--font-comic` | **Bangers 400** | Impact, "Arial Black", sans-serif |
| `--font-ui` | **Fredoka 500/600/700** | "Nunito", "Segoe UI", system-ui, sans-serif |

Usage by element:
- **Lilita One** (letter-spacing .01em, never below 14 px):
  - Logo "ALIEN".
  - h2 screen titles (Mothership, Earth, Paused): clamp(26px, 4vw, 36px).
  - h3: 17px.
  - Primary, slime and danger buttons: 20px desktop, 17px mobile.
  - Timer: 34px desktop, 26px mobile.
  - Invasion unit counter.
  - HUD resource numbers: 20px.
  - Meter values: 16px.
  - Card titles: 18px.
  - War-room numbers: 18px.
  - Stats `dd`: 17px.
  - Duration and defence tags: 13px.
- **Bangers** (letter-spacing .04em):
  - All floating world text (`.ft`): 22px.
  - Comic SFX words: 30px, or 40–48px for the big ones.
  - Toasts: 24px.
  - Logo word "INVASION!".
  - Tutorial step badge.
  - "COMMANDER ZIX" name tab.
  - Eyebrow lines.
  - Loading text: 30px.
  - Touch button labels.
  - "Cities in reach" heading: 18px.
- **Fredoka**:
  - Body: 500 15px/1.45.
  - Balloon and tutorial text: 600 14.5–16px.
  - List titles: 600 14px. List sub text: 500 12.5px.
  - Secondary button labels: 700 14px, uppercase, .05em.
  - Meter labels: 700 11.5px, uppercase, .08em.
  - Keycaps: 700 11px.
  - Globe labels: 700 11px.
  - Costs: 600 13px.
  - Hint bar: 600 12px.
- **Changing numbers.** Neither face guarantees tabular digits.
  - Counters are wrapped in `.num { display:inline-block; min-width:var(--n,3)ch; text-align:right; font-variant-numeric:tabular-nums }`.
  - The timer is rendered as one `<span class="d">` per character, each `display:inline-block; width:.62em; text-align:center` (the colon is .3em), so it never jitters.
- **Long strings.** `text-wrap: balance` on h2/h3. Buttons get `min-width: 7em`.

## 4. Rendering

**Tone and colour (engine.ts)**
- `renderer.toneMapping = THREE.NeutralToneMapping`, exposure 1.05. It replaces ACES, which greys out candy hues.
- `antialias: true` on every device, including touch.
- Pixel-ratio caps stay 1.75 on high and 1.25 on low.
- On the high path the composer render target uses `samples: 4`.
- Delete the PMREM env build and `scene.environment`, because toon materials do not use them.

**Toon ramp (new `src/gfx/toon.ts`)**
- `TOON_RAMP`: an 8×1 DataTexture, `RedFormat`, `UnsignedByteType`, data `[84,84,84,84,148,212,255,255]`.
- Nearest min/mag filtering, `generateMipmaps = false`, `needsUpdate = true`.
- three.js samples the ramp at `dotNL*0.5+0.5`, which gives 4 bands:
  - core shadow: 0.33
  - terminator: 0.58
  - mid: 0.83
  - lit: 1.0
- Hemisphere fill stays smooth, so shadow sides read lavender.

**Materials (kit.ts `MAT`)**
- `std`: `MeshToonMaterial({vertexColors:true, gradientMap:TOON_RAMP})`. No flatShading.
- `metal` and `gloss`: the same, plus an `onBeforeCompile` patch inserted before `#include <opaque_fragment>`:

  ```glsl
  #if NUM_DIR_LIGHTS > 0
    vec3 H = normalize(directionalLights[0].direction + geometryViewDir);
    float sp = step(uSpecCut, dot(normal, H));
    outgoingLight += vec3(1.0) * sp * uSpec;
  #endif
  float rim = smoothstep(0.60, 0.66, 1.0 - max(dot(normal, geometryViewDir), 0.0));
  outgoingLight += uRimColor * rim * uRim;
  ```

- Patch values:

  | Variant | uSpecCut | uSpec | uRim |
  |---|---|---|---|
  | metal | 0.965 | 0.75 | 0.40 |
  | gloss | 0.92 | 1.0 | 0.50 |
  | std | (rim only) | – | 0.28 |

- `customProgramCacheKey` values: `'toon-std'`, `'toon-metal'`, `'toon-gloss'`.
- `uRimColor` is one shared uniform object, set per scene:
  - missions/city: `#8f7dff`
  - snow: `#a8c8ff`
  - globe/space: `#7fd6ff`
- `glow`: unchanged (MeshBasic, `toneMapped:false`).
- Ground planes, the outer plane, lakes, smoke, both Earth spheres, and the city tower material all use MeshToon with the same ramp. The tower material keeps `map`, `emissiveMap`, `emissive 0xffffff` and `emissiveIntensity 1.3`.

**glTF (assets.ts `toLit` becomes `toToon`)**
- Each material becomes `MeshToonMaterial` copying `map, color, vertexColors, transparent, opacity, side, alphaTest, emissive, emissiveMap`, plus `gradientMap` and the std rim patch.
- Untextured materials get an HSL boost: `s = min(1, s*1.25)`, `l = min(0.85, l + 0.04)`.
- Each texture image (the Kenney colormap) is redrawn once through a canvas with saturation ×1.2, and cached per image.
- All converted materials share a program.

**Ink outlines: inverted hull, vertex stage only, the same on high and low, no passes**
- One shared `INK = MeshBasicMaterial({color:#1a1033, side:BackSide, fog:true})`, `customProgramCacheKey 'ink'`. Fog is on, so distant lines fade into the lavender fog.
- **`onormal` attribute:** smoothed normals, computed by grouping vertices by quantised position (1e-3 grid, integer-hash `Map`, never string keys), then summing and normalising. It is built once in `Kit.geos()`, which covers cached models and world kits, and once per glTF geometry at load. This prevents cracks at box corners. Target cost: under 30 ms for the largest kit.
- **Vertex patch:**
  - Declare `attribute vec3 onormal; uniform float uInkPx; uniform vec2 uRes; uniform float uFadeOn;`.
  - For skinning, replace `#include <beginnormal_vertex>` with `vec3 objectNormal = onormal;`.
  - After `#include <project_vertex>`, add:

  ```glsl
  #ifdef USE_SKINNING
    vec3 n0 = objectNormal;
  #else
    vec3 n0 = onormal;
  #endif
  #ifdef USE_INSTANCING
    n0 = mat3(instanceMatrix) * n0;
  #endif
  vec2 d = normalize((projectionMatrix * vec4(normalize(normalMatrix * n0), 0.0)).xy + 1e-5);
  float fade = mix(1.0, clamp(1.0 - (-mvPosition.z - 70.0) / 220.0, 0.35, 1.0), uFadeOn);
  gl_Position.xy += d * uInkPx * fade * 2.0 / uRes * gl_Position.w;
  ```

- **Width:**
  - `uInkPx` = 1.9 CSS px × pixelRatio on high, 1.5 × pixelRatio on low.
  - Globe Earth: 3.5 px. Mothership: 2.5 px. Both use separate INK clones with `uFadeOn = 0`.
  - `uRes` = drawing-buffer size, updated in `onResizeHook`.
  - The portrait renderer swaps `uRes` to its own canvas size around `portrait.render()` and restores it afterwards.
- **Attachment:** call `inkify(mesh)`. It sets `material = [toon, INK]` and adds geometry groups `(0,n,0)` and `(0,n,1)`. It works for Mesh, SkinnedMesh and the StaticBatch InstancedMesh parts, and asserts that `onormal` exists.
- **Inked:** std, metal and gloss Kit meshes, opaque glTF, city towers, smoke puffs, pins, the globe, the mothership, flags, and the mini-saucer markers.
- **Never inked:** glow parts, anything transparent or additive (dome, shields, beam, bubbles, pillars), ground, sky, stars, sparks.
- **`ink:false` MODELS flag:** `flower_red`, `rock_small`, `carrot`. On the low path also `bush`, `stump` and civilians more than 90 units away (checked on a 4 Hz LOD tick that swaps the material array for the plain toon material).

**Lights (set in `nightSky`; per-biome overrides)**

| Light | Colour | Intensity | Notes |
|---|---|---|---|
| hemi | sky `#8f7dff` / ground `#2b1f4f` | 1.25 | cold: `#9fb2ff` / `#6f7fb8`, 1.0 |
| moon (directional) | `#d6e4ff` | 3.0 | pos (-150,170,-170); cold 2.4; desert `#ffe6d0` 3.2 |
| ufo (point) | `#9cff6a` | 140 | distance 42, decay 1.5 |
| beam (spot) | `#eaffd0` | max 600 | penumbra 0.25 |
| flash | `#ff9a3c` | as now | Earth explosions |
| globe | hemi `#9aa8ff`/`#1a1040` 0.8; key `#fff1dc` 3.0 | | key pos (60,40,80) |
| mothership | hemi `#8a7cff`/`#1a1040` 0.7; key `#fff1dc` 3.4 | | |
| Zix portrait | hemi `#b8a8ff`; key `#fff1e0` 2.6; rim `#9cff3f` 1.6 from behind | | |

Do not change the light count per scene, so programs are not recompiled.

**Sky and fog (`gradientSky`: top / horizon / bottom / fog colour / FogExp2 density)**

| Biome | top | horizon | bottom | fog colour | density |
|---|---|---|---|---|---|
| temperate | `0x1b1150` | `0x5a3cc0` | `0x120a35` | `0x3a2a7a` | 0.0036 |
| desert | `0x241048` | `0xa0509a` | `0x1a0c30` | `0x4a2a6e` | 0.0034 |
| tropical | `0x0e1a52` | `0x2f86b8` | `0x0a1430` | `0x1f4a7a` | 0.0036 |
| cold | `0x17215e` | `0x6a8ee0` | `0x101840` | `0x4a5f9f` | 0.0032 |
| city | `0x1a0f4a` | `0x7a3fb0` | `0x120a35` | `0x2e1d63` | 0.0032 |
| globe / mothership | `0x1a0f4a` | `0x2b1670` | `0x0f0828` | – | – |

- **Painted bands:** in the sky fragment shader, `t = floor(smoothstep(0.0, 0.6, y) * 6.0) / 6.0` before the mix.
- **Moon:** a camera-facing plane (120 units) at (-420,380,-560) with a 256 px CanvasTexture:
  - cream `#fff6e0` disc
  - 3 craters in `#d9d0f0`
  - 6 px `#1a1033` ink rim
  - 1.35r halo in `#8f7dff` at 30%
  - MeshBasic colour (2.0,2.0,1.7), `toneMapped:false`, so it blooms on high.
- **Stars:** 85% round 2 px points. The other 15% are a second Points object with a 32 px four-point sparkle texture, size 7 px, `alphaTest 0.3`, colours `#fff6e0` and `#e2d2ff`, and a twinkle via a time uniform. The globe uses 1800 stars.
- **Blob shadows (`shadowTex`):** a hard toon oval in `rgba(26,16,51,.42)`, solid to 78% of the radius and 0 at 86%.

**Bloom and output (high path only)**
- Chain: `RenderPass → UnrealBloomPass(strength 0.6, radius 0.25, threshold 0.95) → ToonOutputPass`.
- `ToonOutputPass` is a ShaderPass that **replaces** OutputPass, so there is no net extra pass. It runs the same tone-mapping and colour-space chunks, plus:
  - a vignette: `mix(col, #1a1033, smoothstep(0.58, 1.0, length(uv-0.5)*1.414) * 0.45)`
  - saturation ×1.06
- The extra-pass budget is left unused as reserve.
- Low path: no composer, no vignette. The look comes from the ramp, ink and palette, so low looks almost identical to high.
- **Bloom rule:** no opaque lit surface may exceed linear luminance ~0.9 under moon and hemi light. QA it with the white cow and the snow ground. Only `glow` k ≥ 2, the moon, explosions and sirens cross 0.95.
- Pre-warm with `renderer.compileAsync(scene, camera)` for every scene behind the loading screen or iris.

## 5. Models

**General.** Every opaque mesh is toon and inked. Colours are candy (saturated, mid value), and the toon ramp does the darkening. The Earth side stays matte. The alien side uses `gloss`, with the hard specular glint and the rim.

**Saucer (`makeUFO`)**
- Hull lathe `#d9def0` (gloss). Rim torus tube 0.17 → 0.26 in `#a77bff` (metal). Underside `#4b3a8f`. Panels `#b8bedc`. Collar `#6a3fe0`.
- Running lights: 14 bulbs, radius 0.3, in an 8 Hz chase cycling slime / bubblegum / poster / earth-cyan (glow k 3).
- Emitter disc slime HDR (0.9, 2.4, 0.5).
- Dome: MeshToon `#8ff4ff`, transparent, opacity 0.32, `depthWrite:false`, renderOrder 2. Glass glint: a white glow `TorusGeometry(2.05, 0.07, 4, 14, PI*0.4)` arc at upper-left, plus a 0.12 dot below it (renderOrder 4).
- Antenna on top of the dome: cylinder 0.05 × 1.1 `#4b3a8f` with a 0.22 slime glow bobble that pulses at 1.5 Hz. It lags with spring motion: rotation follows velocity × −0.04, damped.
- Pilot head: Zix's head at scale 0.75.
- Ink 1.9 px.

**Gray alien (`addGrayHead` / `addGrayBody`: Zix, clones, portrait)**
- Skin `#bcc4e0`. Head scale 0.62 → 0.72 on clones, 0.75 for Zix.
- Eyes `#0b0620` gloss ×1.12, each with two white glow catchlights (k 1.2): sphere 0.05 at the upper-outer area and 0.025 lower-inner. **These dots are not optional**, because they are what makes Zix likeable rather than creepy.
- Mouth: a small smile, `TorusGeometry(0.06, 0.012, 4, 8, PI)` in `#3a2f5a`.
- Clone armour `#7a3cff` (metal) with a slime glow trim stripe (k 1.6). The blaster tip is a slime glow.
- **No antenna, fishbowl helmet or extra eyes on the alien.**
- Portrait background: radial `#3a2696 → #0f0828`.

**Farm animals.** All animals get googly eyes:
- A white `std` sphere (cow 0.16, pig 0.12, sheep 0.11, chicken 0.07).
- A `#1a1033` pupil at 0.45×, pushed forward 0.01.
- A white glow glint at 0.3×, upper-left.

| Animal | Colours and shape |
|---|---|
| Cow | Body `#fff8ee`, spots `#2a1f3f` (boxes 0.04 thick), snout `#ff9fb0` at 0.62×0.36, horns `#ffe6b0`, hooves `#2a1f3f`, pink udder |
| Sheep | Wool ico(0.75, 1) `#f5f0ff` plus 3 extra ico(0.45) puffs (cloud silhouette); face and legs `#2a1f3f` |
| Pig | `#ff9fbf` body, `#ff7fa6` snout and ears, curly tail |
| Chicken | Head 0.22, body `#fffaf0`, comb `#ff3b3b`, beak and legs `#ffb020` |
| Haybale | `#f0c64a` / `#d9a83a` |

**Buildings**
- **Houses:** walls from the pastel set, roofs from the roof set, roof overhang 1.14 → 1.2.
  - Each window gets a `#1a1033` ink frame box (1.15 × 1.2 × 0.06) behind the glass.
  - Lit glass `#ffcf5c` (k 1.3); unlit `#3a3f6e`.
  - Door `#8a4a2a` with a 0.12 yellow knob. Chimney `#8a5a4a`.
- **Barn:** `#e0402f`, trim `#fff3e0`, roof `#4a3f6b`.
- **Silo:** `#c8d0e8` (gloss) with hoops `#8a90b8`.
- **Water tower:** tank `#9fd0ff`, legs `#6a6f9a`, red beacon k 3.
- **Street lights:** pole `#4a4466`, head `#fff0b0` (k 1.3) at 1.25×.
- **Fences:** `#b07a4a`.
- **Barracks:** walls `#7fa04a`, roof `#4f6a2c`.
- **City towers:** tints `#ffb8a0 #a0d8ff #ffe08a #c8a8ff #9fe8c8 #eef0ff`. Window texture redrawn with rounded windows, 3 px `#1a1033` frames, lit `#ffd46b` or `#8fe8ff`, dark `#2a2350`.
- **City ground:** blocks `#8a86a8`, sidewalks `#b8b4d0`, roads `#3d3a5c` with `#ffd23f` dashes, parks `#4f9a45`.
- **Pylons:** base `#4a4466`, shaft `#eef0f8` (gloss) with 3 tomato hazard bands, rings `#5fe8ff` glow k 2.4, core icosahedron HDR (0.6, 2.6, 3.2). Link beams orange.
- **HQ:** walls `#dfe4f2`, upper tier `#c8d0e8`, dome `#ff5a4f` (gloss, the big target), window band `#bfe3ff` glow, red beacon.
- **Mothership:**
  - Hull `#b8bce0` (gloss), outer torus `#6a3fe0`, pods `#4b3a8f`.
  - 60 window slits alternating slime / `#e2d2ff`; 36 orbit bulbs in slime / poster / bubblegum.
  - Top dome `#e2d2ff` k 1.6; underside disc slime k 2.4.
  - Ink 2.5 px. Drones (mini-saucer) use the saucer colours.

**Kenney (minis, cars, city, nature)**
- Toon plus ink, with the atlas saturated ×1.2 once.
- Mini characters: visual scale +10%; hitboxes unchanged.
- Trees: per-model colour multiply toward `#4fae4a` (autumn `#ff8a3a`). Snow pines `#2e6b5a`.
- Police cars stay blue/white with red/blue lights at k 3.

**Quaternius**
- Toon plus HSL boost, plus a `RECOLOR` table keyed by `modelId + material.name`. The engineer logs the names once.
- Soldier `#6f9a3f` with helmet `#4f7a2c`.
- Tanks `#77a843`, tracks `#3a3550`, plus a cream `#fff6e0` star decal (a flat 5-point ShapeGeometry Kit child on the turret).
- Mechs `#a8b0c8` with a tomato visor (matched by name, falling back to the brightest material).
- Deer `#c98a4a`, fox `#ff8a3a`, shiba `#ffb060`, cat `#8a8fa8`.
- Artifacts keep their colours, slow-bob and spin, and carry a poster sparkle.

**White flag:** cloth `#ffffff` glow k 1.1 on a `#b07a4a` pole, both inked. It flutters with `rotation.y = sin(t*4*2π)*0.25`.

## 6. FX

**Tractor beam (`BEAM.mat`, slime)**
- Add `vN` and `vV` varyings to the cone shader.
- Fragment:

  ```glsl
  float band = step(0.55, fract(vUv.y*7.0 - time*1.8));                              // hard rings rising
  float edge = smoothstep(0.55, 0.62, 1.0 - abs(dot(normalize(vN), normalize(vV))));
  float bub  = /* hash cells on (vUv.x*20, vUv.y*8 - time*1.2), dot radius 0.18 cell */;
  float a = (0.12 + 0.38*band*(1.0-0.6*y) + 0.5*edge + 0.25*bub) * alpha;            // cap at 0.55
  vec3 col = mix(vec3(0.55,1.6,0.35), vec3(2.2,2.6,1.6), max(max(band*0.6, edge), bub));
  ```

- Vertex wobble: radius × (1 + 0.04·sin(uv.y·12 + t·5)).
- Ground ring: an outer solid `RingGeometry(0.88, 1.0, 64)` in slime HDR, plus 12 inner dashes rotating at 1.2 rad/s.
- Sparkles: 2 rising sparks per frame (`FX.spark`, grav +6, size 0.25, slime-core). On low, 1 every 2 frames.

**Abduction (goo jelly)**
- **Lift start:** squash the target to (0.9, 1.18, 0.9) over 120 ms, then ease back.
- **Jelly bubble:** wrap the target in a shared bubble, `SphereGeometry(1, 16, 10)` × 1.4 × target radius. It uses a fresnel material in slime, power 1.4, opacity 0.5, stepped as `floor(f*3.0+0.15)/3.0`. At most 6 bubbles exist at once (pooled).
- **While lifted:**
  - wobble `rotation.z = sin(t*6)*0.22`
  - scale.y = 1 + 0.12·sin(t·9), xz inverse
  - slow spin
  - a 40% chance of a `.ft.say` shout
- **Arrival (bank):**
  - The bubble pops: scale 1 → 1.4 and opacity → 0 over 0.18 s.
  - 8 poster star sparks and 10 slime sparks.
  - The word **"BLORP!"**.
  - A resource float in the resource colour ("+3").
  - The saucer burps: body spring to (1.08, 0.9, 1.08).
  - The matching HUD chip pops.

**Stun ray**
- Bubblegum core HDR (3.2, 1.1, 2.4), width 0.32, plus a white inner line HDR (3, 3, 3) at width 0.12 (2 instances).
- On hit: 6 bubblegum star sparks and a UV-free shockwave ring (flat, 0 → 2.5 over 0.25 s, bubblegum).
- **Dizzy stars:** stunned entities (`e.stun > 0`) get 3 poster stars (`FX.glowMesh`, HDR 3.2, 2.6, 0.6, size 0.22) orbiting at head height, radius 0.55, 4 rev/s. Cap 40 entities (120 instances). This replaces the `'✦ ✦ ✦'` text.
- **Earth fire is always orange:**
  - pistol HDR (4, 2.4, 0.6)
  - tank HDR (4, 1.6, 0.4) at 1.4× width
  - missile trails leave toon puffs every 0.08 s

**Explosions (`FX.explode`)**
- `smokeMesh` = `IcosahedronGeometry(0.5, 1)`, MeshToon with `instanceColor`, inked (cotton puffs).
- Colour over life:
  - 0–15%: `#fff6e0`
  - → 35%: `#ffd23f`
  - → 60%: `#ff9a3c`
  - → end: `#9b8fc8`
- Scale: pop 0 → 1.15 in 0.12 s, settle at 1.0, then shrink to 0. Rise speed ×0.8. Spark count −30% and sizes +30%.
- Fire sparks: poster HDR (4, 3.2, 0.8) and orange HDR (4, 1.6, 0.4) icos, sizes 0.9 / 0.7, life 0.45 s.
- Shock ring: a flat RingGeometry at y 0.1, additive, white → poster, radius 0 → 6 × size over 0.25 s. It reuses a pillar slot.
- Camera shake unchanged.

**Pillars, shields and surrender**
- Send-cargo pillar: slime with 4 hard bands scrolling up (beam band shader, 16 segments).
- Saucer-down pillar: tomato.
- Shields: `fresnelMaterial` quantised as `f = floor(f*3.0+0.15)/3.0`, hex shimmer kept. Player shield violet `#a77bff` power 2.0; HQ `#5fe8ff`. On hit: flash to white for 80 ms, plus a vertex wobble (amplitude 0.2, decay `exp(-6t)`).
- Surrender: the flag pops with scale 0 → 1.2 → 1 over 0.3 s, plus a `.ft.say` bubble and 4 confetti sparks (poster, bubblegum, slime).

**Comic words (`FT.spawn(pos, word, 'sfx <kind>', 0.7, 3.5)`)**

| Event | Words | Size | Fill / burst |
|---|---|---|---|
| Beam switches on (1.5 s cooldown) | FWOOMP! | 30 | slime-core / slime |
| Lift start | YOINK! · SHLOOP! · WHEEE! | 30 | poster / bubblegum |
| Banked in saucer | BLORP! | 30 | slime / violet-deep |
| Stun hit (≤ 1 per 0.35 s) | ZAP! · BZZT! · ZZT! | 26 | bubblegum / cream |
| Small explosion | POW! · BLAM! · CLANG! | 30 | poster / tomato |
| Large explosion (size > 1.3, ≤ 1 per 0.4 s) | KA-BOOM! · KA-POW! | 38 | poster / tomato |
| Pylon destroyed | KER-CHUNK! | 40 | poster / tomato |
| HQ destroyed | KA-BLOOEY! | 48 | poster / tomato |
| Cargo send | WHOOSH! | 30 | slime-core / violet |
| Shell/bullet hits player shield | BONK! · DOINK! | 28 | cream / violet |

`.ft.say` lines (balloons, not SFX):
- Humans: "HELP!", "Not again!", "My hat!"
- Animals: cow "MOO?!", sheep "BAA?!", pig "OINK?!", chicken "BAWK!"
- Surrender: "I GIVE UP!", "WE SURRENDER!", "TAKE THE TANK!"
- Stunned soldiers: a 30% chance of "#@$%!"

Throttle:
- 0.25 s global cooldown between SFX words.
- At most 5 SFX alive (3 while `#tut` is open).
- On low, only events with size ≥ 1.

**Damage feedback**
- Shield hit: shield meter shake, bubble flash, and a DOM `#hurt` overlay (pre-rendered radial gradient, transparent → `rgba(255,90,79,.35)`) animating **opacity only** 0 → 1 → 0 over 0.25 s.
- Low shield (< 25%): the same overlay pulses at 1 Hz between opacity 0.3 and 0.6.

**Squash-and-stretch.** A generic jelly spring on any entity's visual root:
- On hit, set `s = 1`.
- `scale = (1+0.22·s·sin(30t), 1−0.22·s·sin(30t), 1+0.22·s·sin(30t))`.
- `s *= exp(−8·dt)`.
- The saucer idles at `scale.y = 1 − 0.06·sin(t·3)` and stretches to (0.85, 1.15) for 150 ms on boost start.

## 7. UI components

**Global rules**
- No `backdrop-filter` anywhere.
- Every text element sits on a solid fill or carries the ink stroke.
- Ink stroke utility for text over the 3D view:
  ```css
  --stroke: 2px 0 0 var(--ink), -2px 0 0 var(--ink), 0 2px 0 var(--ink), 0 -2px 0 var(--ink),
            1.5px 1.5px 0 var(--ink), -1.5px 1.5px 0 var(--ink), 1.5px -1.5px 0 var(--ink), -1.5px -1.5px 0 var(--ink);
  ```
  Use `text-shadow: var(--stroke), 0 4px 0 var(--ink)`. Do not rely on `paint-order`.
- Animate only `transform`, `opacity`, `scale` and `rotate`.

**Panel (`.card`, `.ms-panel`, `.g-panel`, war room, briefing/summary/pause/end)**
- `background: linear-gradient(180deg, #3a2696 0%, #2b1b72 100%)` at alpha .94.
- `border: 3px solid var(--ink)`; `border-radius: 18px`.
- `box-shadow: 0 6px 0 var(--ink), inset 0 2px 0 rgba(255,255,255,.14), inset 0 -3px 0 rgba(0,0,0,.18)`.
- h2: Lilita One, poster, `text-shadow: 0 3px 0 var(--ink)`. h3: Lilita One 17px `--violet-hot`.

**Slime cap (`.slime-cap`).** Brand surfaces only: the title logo, the loading screen, and the top edge of the briefing, summary and end cards. Never on the HUD, tutorial, globe panel or comm balloon.
- A 22 px strip with a `linear-gradient(#d4ffa8, #9cff3f 45%, #4fbf1a)` fill, masked by a repeat-x 180×22 drip SVG (data URI).
- The same mask in ink, offset 3 px down, acts as the outline.
- Animation: `scaleY 1 → 1.15 → 1` over 3.2 s, `transform-origin: top`.

**Buttons (`.btn`)**
- Base: Fredoka 700 14px, uppercase, `.05em`; padding `.72em 1.3em`; radius 14px; `border: 3px solid var(--ink)`; `box-shadow: 0 5px 0 var(--ink), inset 0 2px 0 rgba(255,255,255,.35)`; min-height 44px; transition .1s.
- States:
  - Hover: `translateY(-2px)`, shadow `0 7px 0`.
  - Active: `translateY(4px)`, `scale(.97)`, shadow `0 1px 0`.

| Variant | Fill | Text | Extra |
|---|---|---|---|
| `.btn` (secondary) | `#6a3fe0` | `#fff` | inset `0 -4px 0 #4b2bb0` |
| `.btn.primary` | `#ffd23f` | ink, Lilita One 20px | inset `0 -4px 0 #e09a00`, inset `0 3px 0 rgba(255,255,255,.6)` |
| `.btn.slime` (BUILD, Launch, "Beam down!") | `#9cff3f` | ink | inset `0 -4px 0 #4fbf1a` |
| `.btn.danger` | `#ff5a4f` | `#fff` | inset `0 -4px 0 #c43a30` |
| `:disabled` | `#4a4470` | `#9d95c8` | no lift, opacity 1 |

- Focus: `outline: 3px solid var(--slime); outline-offset: 3px`.

**HUD meters (top-left sticker card)**
- Panel style, padding 10px 12px, width 250px (200px on mobile).
- Labels: Fredoka 700 11.5px, uppercase, `--text`.
- Bars:
  - 14px tall (boost 9px), radius 7px, `border: 2.5px solid var(--ink)`, track `#1b1150`.
  - Fill = gradient + gloss `linear-gradient(180deg, rgba(255,255,255,.45) 0 40%, transparent 40%)` + ticks `repeating-linear-gradient(90deg, transparent 0 calc(10% - 2px), rgba(26,16,51,.35) calc(10% - 2px) 10%)`.
  - Shield: `#a77bff → #e2d2ff`; below 25% it turns tomato and shakes. Cargo: `#e09a00 → #ffd23f`; when full it wobbles and shows a "FULL!" tag. Boost: `#4ff0d0`.
- Values: Lilita One 16px white `.num`.

**Resource chips (HUD, globe top bar, mothership)**
- Pill: bg `#2b1b72`, `border: 2.5px solid var(--ink)`, shadow `0 4px 0 var(--ink)`, padding `3px 12px 3px 4px`.
- Icon: a 26px circle badge in the resource colour with the ink icon inside and a 2px ink border.
- Number: Lilita One 20px white with `var(--stroke)`.
- On gain:
  - `.pop` animates `scale 1.3 → 1` over 0.18s with a white flash.
  - A "+N" tag (Fredoka 700 12px poster) floats 12px up and fades.
  - `UI.set` diffs values to toggle it.

**Mode label, timer, alert pips, objective (top centre)**
- Mode label: Bangers 15px `--violet-hot` on an ink pill (radius 999px, padding 2px 12px).
- Timer: Lilita One 34px white with `var(--stroke), 0 4px 0 var(--ink)` and per-digit spans. At ≤ 10 s it turns tomato with a 1 Hz scale pulse to 1.08.
- Alert pips: 18×10, radius 5px, 2px ink border. Off: `rgba(255,90,79,.2)`. On: tomato with an inset gloss and a siren blink.
- Objective: Fredoka 700 14px ink on a poster pill (radius 999px, 2.5px ink border, shadow `0 3px 0 var(--ink)`).

**Toasts**
- Bangers 24px, `.04em`; padding `6px 18px 8px`; radius 14px; 3px ink border; shadow `0 5px 0 var(--ink)`.
- `rotate: -2deg`, or `1.5deg` on even children.
- Fills: info `#6a3fe0` with white text; `.good` poster with ink text; `.warn` tomato with white text.
- Enter: scale .6 → 1.08 → 1 over 0.26s.

**Commander bubble (`#comm`)**
- **Portrait porthole:** 72px circle, bg `radial-gradient(#3a2696, #0f0828)`, `border: 3px solid var(--ink)`, `box-shadow: 0 0 0 3px var(--slime), 0 5px 0 3px var(--ink)`.
- **Balloon:**
  - Fill `--cream`, ink Fredoka 600 14.5px/1.38, 3px ink border, radius 20px, padding 10px 14px, shadow `0 5px 0 var(--ink)`.
  - A 14px tail toward the portrait: `::before` in ink, `::after` in cream offset 4px.
- **Name tab** "COMMANDER ZIX": Bangers 13px, white on `#6a3fe0`, 2.5px ink border, radius 8px, at `top:-12px; left:14px`, `rotate:-3deg`.
- **`<b>`:** `#6a3fe0` weight 700 with a highlighter `background: linear-gradient(transparent 58%, #ffe066 58%)`. Never yellow text on cream.
- **Motion:** enter pops from scale .8 at the portrait origin; the balloon wobbles ±2deg while a line types out.
- The briefing face uses the same porthole at 150px.

**Tutorial box (`#tut`)**
- Card: cream, 3px ink border, radius 18px, shadow `0 6px 0 var(--ink)`, padding `0 0 12px`, `overflow: hidden`.
- **Header strip:** poster fill, 3px ink bottom border, padding 6px 14px.
  - Left: a 28px inline-SVG saucer glyph, then "TRAINING 1/6" in Bangers 16px ink.
  - Right: "Skip tutorial" in Fredoka 700 12px `#4b2bb0`, underlined 2px.
- **Body:** Fredoka 600 16px/1.4 ink, padding 10px 16px; `<b>` as in `#comm`.
- **`.tut-target`:** `outline: 4px solid var(--slime)` plus a pulsing `box-shadow: 0 0 0 8px rgba(156,255,63,.35)`.
- On mobile, keep it under 30% of screen height.

**Globe side panel (`.g-panel`)**
- Sticker panel, 380px wide. On mobile it becomes a bottom sheet with a 6px ink grab handle.
- Header: "Choose a target" in Lilita One 22px poster; sub text Fredoka 500 13px `--dim`.
- **`.g-site` rows:**
  - bg `#3a2696`, 2.5px ink border, radius 14px, padding 8px 10px, shadow `0 3px 0 var(--ink)`.
  - Hover lifts 2px.
  - `.sel`: poster fill, ink text, sub text `#4b2bb0`.
- **Left 28px badge:**
  - abduction site: slime with an ink saucer glyph
  - invadable city: tomato with a pin glyph
  - occupied: slime with an ink flag glyph and a 2px violet ring
- **Tags:** Lilita One 13px pills with a 2px ink border. Duration: slime with ink text. Defence: tomato with white text.
- "Cities in reach": Bangers 18px tomato.
- Top bar: wallet as resource chips; the Mothership button is `.btn` (violet) with a mini-saucer glyph; the AWARE and CITIES meters use the HUD meter style (Aware tomato with hazard ticks, Cities slime).

**Map labels (`.g-label`)**
- Cream pill, ink Fredoka 700 11px, 2px ink border, radius 8px, padding 1px 7px, shadow `0 2px 0 var(--ink)`.
- `.occ`: slime bg with ink text. `.sel`: poster bg at 13px.
- Fade by distance; hide on the far hemisphere.

**Minimap**
- 150px circle (100px on touch), `border: 4px solid var(--ink)`, `box-shadow: 0 0 0 3px var(--slime), 0 6px 0 3px var(--ink)`, bg `#10203a`.
- Map drawn at 0.8 alpha.
- Sweep: drawn in canvas as a `rgba(156,255,63,.22)` wedge at 0.25 rev/s.
- Dots get a 1px ink ring:
  - player: 8px slime
  - enemies: tomato
  - loot: poster
  - animals: `#c6f04a`
  - humans: `#ffb38a`
  - tutorial target: pulsing poster ring

**Deploy bar (invasion)**
- Cards 96px wide in the sticker style.
- Number-key badge: a 20px ink circle with a poster digit, sitting top-left at −6px.
- Unit name: Fredoka 700 12px. Cost row: `.num` chips.
- Hover lifts. A unit you can't afford uses the disabled colours.
- Hint bar: Fredoka 600 12px on an `rgba(26,16,51,.72)` pill (radius 999px, padding 4px 14px).
- Keycaps (`kbd`): cream, ink text, 2px ink border with a 4px bottom border, radius 6px, Fredoka 700 11px.

**Touch controls**
- All touch buttons: ink 3px border, shadow `0 6px 0 var(--ink)`, label Bangers in ink.

| Button | Size | Fill | Extra |
|---|---|---|---|
| BEAM | 96px | slime | inset `0 -6px 0 #4fbf1a`, label 18px; `.on` = `translateY(4px)` plus `0 0 24px var(--slime)` |
| ZAP | 64px | bubblegum | |
| BOOST | 54px | mint | |
| SEND | 54px | poster | |

- Joystick: base `rgba(26,16,51,.45)` with a 3px ink border and a 2px violet inner ring. Knob 58px violet with gloss `inset 0 4px 0 rgba(255,255,255,.4)` and an ink border.

**Title logo** (`<h1><span class="logo-alien">ALIEN</span><span class="logo-ribbon">INVASION!</span></h1>`)
- **"ALIEN":**
  - Lilita One `clamp(56px, 12vw, 128px)`, slime fill.
  - `text-shadow`: an 8-direction 4px ink ring, then `0 6px 0 #4fbf1a, 0 10px 0 var(--ink), 0 18px 24px rgba(0,0,0,.45)`.
  - `rotate(-4deg)`.
  - The dot on the I is replaced by a small SVG saucer.
  - A `.slime-cap` drip strip hangs under the word.
- **"INVASION!":** Bangers `clamp(26px, 5vw, 52px)`, poster with `var(--stroke)`, on a `#6a3fe0` ribbon (3px ink border, notched-end `clip-path`, `rotate(3deg)`) overlapping the bottom of ALIEN.
- **Logo motion:** idle wobble of `rotate ±1.5deg` over 3s ease-in-out, plus a `translateY ±4px` float.
- **Eyebrow** "A GRAY EMPIRE PRODUCTION": Bangers 15px `--violet-hot`, `.2em`.
- **Tagline:** Fredoka 600 19px `--text` with `0 2px 0 var(--ink)`; `<b>` in slime or poster.
- **Scrim:** `linear-gradient(to top, rgba(15,8,40,.9), rgba(15,8,40,.25) 55%, transparent 78%)`.
- **Buttons:** primary "NEW GAME" plus secondary violet "HOW TO PLAY", both 56px tall.

**Loading screen (`#loading`)**
- bg `radial-gradient(circle at 50% 42%, #3a2696, #0f0828 70%)`.
- A pure-CSS saucer:
  - 140×40 ellipse `#d9def0` with a 3px ink border, dome `#8ff4ff`, 5 candy bulbs blinking.
  - Bobbing `translateY ±6px` over 1.6s.
- A slime beam trapezoid below it (`clip-path`), flickering in opacity .5–.9, ending in a `.slime-cap` puddle.
- Text "Warming up the saucer…" in Bangers 30px poster with `var(--stroke)`.
- Progress: a 260×18 sticker meter with a slime fill.
- Hide only after `Promise.race([document.fonts.load('40px "Lilita One"'), timeout(2500)])` **and** the scene's `compileAsync` has finished.

**Screen transitions ("iris")**
- A single `#iris` div: a circle with `box-shadow: 0 0 0 200vmax var(--ink)`, positioned at the saucer's or the clicked button's screen point.
- Close: scale 2.4 → 0 over 0.38s, `cubic-bezier(.6,0,.8,.2)`.
- While closed: hold 80ms, swap scenes, `compileAsync`.
- Open: scale 0 → 2.4 over 0.42s, `cubic-bezier(.2,.8,.4,1)`.
- A tiny SVG saucer zips across while it is closed.
- Used for: title→globe, globe→mission/invasion, mission→summary, globe↔mothership.
- Panels inside the new screen pop in with a 40ms stagger (scale .9 → 1.03 → 1, 0.24s).
- **Each scene entry calls `UI.globe(false)`, `hideLabels()` and resets `#g-labels` before `UI.hud(true)`**. The baseline snow shot shows the globe UI leaking into a mission.

## 8. Globe

**`drawEarth` (2048×1024)**
- **Ocean:** vertical gradient `#1f5fb0 → #2a7fd6 → #1f5fb0`. Add 300 seeded wave arcs (2px, `rgba(255,255,255,.08)`), drawn before the land. Grid every 30° in `rgba(255,255,255,.07)`, 1px.
- **Coast halo:** before filling land, stroke every polygon with `#7fd0ff` at alpha .4, lineWidth 10.
- **Land:** temperate `#6cc24a`, desert `#f0c060`, tropical `#2fb35a`, cold `#eef4ff`, Antarctica `#f4f8ff`.
- **Locked regions:** `mix(col, #4a4f7a, .55)`, plus a hatch from an 8px pattern tile (2px diagonal ink stripes at .18).
- **Alert:** mix toward tomato by `alert/220`.
- **Borders:** countries in ink at .45, 1.5px. Region boundaries (neighbours differ) re-stroked at 3px, ink .8.
- **Selected region:** 9px ink stroke, then 5px poster on top.
- **Occupied territory (goo):**
  - A radial slime puddle (`#9cff3f` at .85 → 0).
  - 7 satellite blobs at radius ×0.85 (each r ×0.25) for a lumpy edge.
  - A 3px `#4fbf1a` rim stroke.
  - A `#eaffd0` highlight dot.
  - The puddle spreads (redraw radius eases from 0 to full over 1.2s) when a city falls.

**Earth mesh and background**
- Earth: MeshToon `{map, gradientMap: TOON_RAMP}`, which gives 4 hard day/night bands. uRimColor `#7fd6ff`. Ink 3.5px, no fade.
- Atmosphere: fresnel `#6fe0ff`, power 2.6, opacity .9, stepped as `floor(f*2.0+0.2)/2.0` (a cartoon halo ring).
- Background: gradientSky (globe row in §4), sparkle stars, and one ringed cartoon planet at (-140, 60, -220), radius 9: toon `#ff8a5a` with a `#ffd23f` ring, inked.

**City pins**
- Toy map pin: an inverted-cone tip (0.09 × 0.3) plus a 0.16 head sphere with a white glow glint dot (r .04, upper-left). Stick `#e2d2ff`. Inked.
- Heads:
  - invadable: tomato
  - occupied: slime HDR (0.9, 2.4, 0.5) with a small drip cone underneath
  - locked: `#8a8fb0`
- Selected: spring to scale 1.35 with overshoot, plus a 1.5 Hz bounce (+0.08).

**Mission sites**
- Slime ring torus HDR (0.9, 2.4, 0.5), tube 0.06.
- A sonar ping: a second ring scales 1 → 1.6 as opacity goes 1 → 0, on a 1.4s loop.
- Above it, a hovering `miniSaucer()`:
  - scale 0.11, 0.55 above the surface
  - bob ±0.05 at 2 Hz, spin 2 rad/s
  - a thin slime beam cone to the ground
  - inked
- Selected: saucer ×1.3 and the ring turns poster.
- At most 6 sites. Pick proxies unchanged.

The mothership's Earth reuses `earthCanvas()` with the same toon material and stepped atmosphere.

## 9. Motion & juice

| Element | Motion | Timing / easing |
|---|---|---|
| Button hover / press | `translateY(-2px)` / `translateY(4px) scale(.97)` | .1s ease-out |
| Panel / card enter | scale .9 → 1.03 → 1, 40ms stagger | .24s `cubic-bezier(.2,1.6,.4,1)` |
| Toast | scale .6 → 1.08 → 1, rotate ±2deg | .26s same curve |
| FT / SFX pop (individual `scale`/`rotate` props, never `transform`) | scale .3 → 1.25 → 1, `rotate: var(--rot)` (random −12..12deg) | .28–.55s `cubic-bezier(.2,1.8,.4,1)` |
| Resource chip gain | scale 1.3 → 1, white flash, +N float | .18s |
| Shield meter hit | `translateX ±3px` ×3 | .25s |
| Timer urgent | scale 1 → 1.08 → 1 | 1 Hz |
| Logo | rotate ±1.5deg, translateY ±4px | 3s ease-in-out alternate |
| Slime drips | scaleY 1 → 1.15 → 1 | 3.2s ease-in-out |
| Iris | close .38s, hold .08s, open .42s | see §7 |
| Saucer idle / boost | scale.y 1 − 0.06·sin(3t); stretch (0.85, 1.15) | 150ms on boost |
| Saucer burp (bank) | spring to (1.08, 0.9, 1.08) | k 180, damping 12 |
| Jelly hit spring | ±0.22 at 30 rad/s | decay `exp(−8t)` |
| Abductee lift | squash (0.9, 1.18, 0.9), then wobble sin(6t)·0.22 | 120ms, then loop |
| Bubble pop | scale 1 → 1.4, opacity → 0 | .18s |
| Flag pop | 0 → 1.2 → 1 | .3s |
| Dizzy stars | orbit r .55 | 4 rev/s |
| Antenna bobble | pulse 1.5 Hz; spring lag on velocity | |
| Smoke puff | 0 → 1.15 (0.12s), settle, shrink | life ~0.9s |
| Globe pin / site select | spring scale with overshoot | .3s |
| Loading saucer | translateY ±6px | 1.6s |

- `prefers-reduced-motion` already zeroes CSS animations, so every UI loop must be a CSS animation. Under reduced motion the JS-driven ones also stop: the logo wobble (CSS), the minimap sweep, and the iris (it becomes a 0.2s fade).
- No more than 6 infinite CSS animations on screen at once.

## 10. Do / Don't

**Do**
- Use the one ink colour `#1a1033` for every outline, border and hard shadow, in both 3D and UI.
- Keep lime slime = alien action, violet = alien tech, poster yellow = call to action, tomato = danger and Earth targets, cyan = Earth tech, orange = Earth fire.
- Give every face eyes with white catchlights (alien and animals).
- Put every HUD string on a solid pill or under `--stroke`.
- Make shadows lavender; let the hemi fill do it.
- Use `inkify()` and the shared `INK` material; compute `onormal` once per geometry.
- Pre-compile behind the loading screen or iris.
- Keep the stun ray comedic: dizzy stars, white flags, "I GIVE UP!".
- Self-host the fonts.
- Fix the globe-UI leak on every scene entry.

**Don't**
- Ink anything transparent or additive, ground, sky or particles.
- Let Earth windows or lamps exceed k 1.3. Only alien tech blooms.
- Use alien colours (lime, violet, bubblegum) for Earth weapons, or orange for alien things.
- Put yellow text on cream, or rely on `paint-order` or `-webkit-text-stroke`.
- Use `backdrop-filter`, blurred box-shadows on panels, or layout-affecting animations.
- Add a full-screen pass. ToonOutputPass *replaces* OutputPass, and low stays composer-free.
- Give Zix antennae, a fishbowl helmet, extra eyes or green skin, or copy any franchise's character, logo or lettering.
- Use more than three font families, or Fredoka/Lilita for changing numbers without the `.num` / per-digit wrappers.
- Spam comic words beyond the throttle, or show them over the tutorial card.
- Change gameplay: hitboxes, speeds and AI are untouched.

## 11. Performance budget

| Item | High | Low |
|---|---|---|
| Full-screen passes | Render + Bloom + ToonOutputPass (same count as today) | 0 (direct render) |
| Pixel ratio cap | 1.75 | 1.25 |
| MSAA | composer target samples 4 | `antialias: true` |
| Draw calls (mission, worst case) | ≤ 420 | ≤ 320 |
| Extra draws from ink | ≤ +120 | ≤ +80 (ink off on bush, stump, small props, civilians > 90u) |
| `onormal` build | ≤ 30ms per largest kit, once | same |
| Inked instanced parts | +1 draw per StaticBatch part | same |
| Jelly bubbles / dizzy-star instances | 6 / 120 | 4 / 60 |
| Beam sparkles | 2 per frame | 1 per 2 frames |
| Smoke instances | as today, sparks −30% | as today |
| Comic SFX alive | 5 | 3 (size ≥ 1 events only) |
| DOM: infinite CSS animations visible | ≤ 6 | ≤ 4 (decorative drips/logo wobble off in missions on touch) |
| Full-screen DOM overlays | `#hurt` (opacity only, transient), `#iris` (transitions only) | same |
| Fonts | 3 families, ~120KB woff2, 2 preloaded | same |
| Shader programs | toon-std/metal/gloss, ink, ink-nofade, glow, beam, fresnel, sky, stars (compiled on load) | same |
| Frame target | 60 fps desktop; ≥ 45 fps on a mid phone in the farmland world with 60 minis | ≥ 50 fps on a mid phone |

**If a phone misses its target, cut in this order:**
1. Lower the pixel ratio on low.
2. Turn off ink on civilians beyond 60u.
3. Halve the sparkle star count.
4. Turn off the beam bubbles term.

Never remove ink from the saucer, aliens, animals or buildings.

**QA.** One screenshot pass per scene (title, training, desert, tropical, snow, city, globe, mothership), checking:
- that no lit opaque surface blooms;
- that the ink has no cracks;
- that the HUD is readable over snow and city.

---

## Appendix: how this guide was chosen

Three art directions were pitched independently (Moonlit Toybox, Saucer Saturday, Goo & Glow) and scored by a creative director.

| Pitch | Cartoon-alien appeal | Coherence | Readability | Mobile perf | Implementability | Total |
|---|---|---|---|---|---|---|
| A. Moonlit Toybox | 8 | 9 | 9 | 8 | 8 | **42** |
| B. Saucer Saturday | 8 | 7 | 8 | 7 | 6 | 36 |
| C. Goo & Glow | 9 | 7 | 7 | 6 | 5 | 34 |

**Verdict.** Moonlit Toybox (A) is the backbone. Its vertex-stage ink outline looks the same on the high and low paths and adds no pass. Its sticker UI and palette are the most complete and easiest to read.

Grafts from the other two pitches:
- From B: comic SFX words with word lists and throttling, googly eyes with a glint, puff colours that change over the puff's life, the antenna on the saucer rather than on the alien, and a mini-saucer marker on mission sites.
- From C: the "goo" story (Gray Empire territory spreads as slime on the globe, abductees ride up inside a jelly bubble and land with a "BLORP"), slime drips used only on brand surfaces, the rule that only alien tech blooms, Earth weapons always orange, the jelly hit-spring, and vignette folded into the existing output pass.

Rejected:
- Matcap chrome, because it adds a second lighting model.
- Halftone sky, because it adds visual noise behind the HUD.
- Depth-edge ink pass, because only the high path would have it, so high and low would look different.
- Rubik Wet Paint and blobby border-radius, because they hurt readability.
- Glow cards, because they add work for little gain.
- Space Mono and Nunito, because four font families is too many.

**Work split** (one engineer per lane):
- **E1 Rendering:** engine.ts, toon.ts (new), kit.ts MAT, assets.ts, common.ts sky.
- **E2 Models:** models.ts, biomes.ts, city.ts.
- **E3 FX:** fx.ts, player.ts, FT and comic words.
- **E4 UI:** style.css, index.html, ui.ts feedback hooks.
- **E5 Globe and mothership:** globe.ts, mothership.ts.

---
