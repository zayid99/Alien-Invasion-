# Moon Base room screen: reference UI

Layout from Zayid's wireframe (16 Nov 2026), drawn over the live game. The room plays in the central **viewport window**
(the wireframe's red area); the controls are the gray blocks, at the same positions, scaled to a 1280 × 707 screen.

| Wireframe block | Control | Changes per room? |
|---|---|---|
| Top-left, wide | Back + room name plate | name |
| Top-right, big square | Resources (humans, biomass, metal) and the day | no |
| Left, upper | Moon Map (the whole moon, all rooms) | no |
| Left, lower | Rooms: next / previous | no |
| Right, middle | Info: how this room works | text |
| Right, lower | Live status (e.g. "Vat 3 · Growing 72 %") with a bar | yes |
| Bottom-left, wide | The room's main action (big green) | yes |
| Bottom, middle pair | Two secondary actions | yes |
| Bottom-right | To Earth | no |

Per room: Hybrid Lab (grow clone, ×5, brute), Shipyard (build saucer, ×5, walker), Research Lab (upgrade beam, shield,
engine). A tip line sits along the top edge of the window.

Images: `room-screen-hybrid.jpg`, `room-screen-shipyard.jpg`, `room-screen-research.jpg`.
Re-render: `npm run build && npx vite preview --port 4175`, then `node tools/ui-reference.cjs <out-dir>`.
