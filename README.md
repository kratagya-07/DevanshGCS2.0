# Swarm Ops — Ground Control (Next.js)

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Why this fixes the map errors you were seeing

Opening a plain `.html` file directly (`file://...`) sends no proper
`Referer` header, and some tile providers (OpenStreetMap's own servers,
Google) reject or rate-limit requests like that — that's the
"access blocked" / "API key required" errors you hit before.

A Next.js dev server serves the page over `http://localhost:3000`, a
real HTTP origin, so tile requests carry a normal referer and load
normally. The two tile sources used here need no API key at all:

- Street: `tile.openstreetmap.org`
- Satellite: `server.arcgisonline.com` (Esri World Imagery)

## Where things live

- `pages/index.js` — page state: drone data, the telemetry simulator,
  follow/base-layer toggles. Replace the `setInterval` simulator with
  your real WebSocket/MAVLink feed and call `setDrones()` the same way
  — nothing else needs to change.
- `components/LeafletMap.jsx` — the map: markers, rotation, trails,
  cursor readout.
- `components/Sidebar.jsx` — fleet status cards, compact telemetry
  panel with Round HUD, expanded modal HUD on click.
- `components/HUD.jsx` — full rectangular Attitude Director Indicator
  (ADI) with speed tape, altitude tape, heading tape, and bottom status
  bar. Used in the expanded modal overlay.
- `components/RoundHUD.jsx` — compact circular ADI rendered on a
  `<canvas>` element. Sits between the two telemetry columns in each
  drone card inside the Sidebar. Supports an optional `onExpand`
  callback that opens the full HUD modal.
- `components/Header.jsx` — top bar.
- `styles/globals.css` — all styling (ported from the original
  single-file dashboard, extended with telemetry panel, round HUD,
  and modal HUD layout tokens).

## HUD Components

### `HUD.jsx` (Rectangular ADI)

Full-featured aviation-grade HUD rendered on a high-DPI `<canvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `drone` | object | Drone telemetry: `roll`, `pitch`, `hdg`, `spd`, `alt`, `vz`, `batt`, `sats`, `armed`, `vx`, `vy` |
| `label` | string | Drone identifier shown in top-left corner |
| `color` | string | Accent color (hex) for altitude tape and label |
| `expanded` | bool | `true` → 420×340, `false` → 240×200 |
| `onToggleExpand` | fn | Callback to toggle expanded state |
| `distGCS` | number | Distance from GCS in metres for the DIST readout |
| `width` / `height` | number | Override canvas size |
| `hideExpand` | bool | Hides the expand/minimize button |

### `RoundHUD.jsx` (Circular ADI)

Compact circular artificial horizon designed to sit inline between
drone telemetry columns. Rendered on a high-DPI `<canvas>` with
2x supersampling for razor-sharp lines on all displays.

| Prop | Type | Description |
|------|------|-------------|
| `drone` | object | Telemetry: `roll`, `pitch`, `hdg` |
| `color` | string | Accent color (hex) for bezel ring and HDG pill |
| `size` | number | Diameter in px (default `124`) |
| `onExpand` | fn | Optional callback — shows an expand button overlay |

Features rendered by `RoundHUD`:
- Roll scale arc with tick marks at 0, 10, 20, 30, 45, 60 deg bank
- Yellow zero-roll indicator triangle (fixed on bezel)
- Rotating yellow roll pointer
- Clipped artificial horizon with sky/ground gradient
- Pitch ladder rungs (dashed below horizon) with degree labels
- Fixed yellow aircraft reticle (center pip + wing bars)
- Bottom digital HDG pill readout
- Top compact attitude mini-readout (R+/- P+/-)

## Sidebar Drone Cards (updated layout)

Each drone card now shows a **three-column telemetry panel** instead
of the old DATA / HUD tab toggle:

```
+----------------+------------+----------------+
|  Left column   | Round HUD  | Right column   |
|  ALT  SPD      |  (130 px   |  LAT  LON      |
|  VZ   HDG      |  circular  |  RLL  PTC      |
|  BATT SATS     |   canvas)  |  YAW  VXY      |
+----------------+------------+----------------+
```

Clicking the small expand button on the Round HUD opens a
**full-screen modal** with the rectangular `HUD` component at
420x340, which can be dismissed by clicking outside it.

## Adding the next features

- **Video feed**: new component `components/VideoFeed.jsx`, drop it
  into `pages/index.js` next to the map. Backend converts each drone's
  RTSP stream to WebRTC/HLS; this component just points a `<video>`
  tag at that stream URL.
- **Delivery tagging**: new `components/DeliveryPanel.jsx` + a
  `people` array in state (or fetched from your backend/DB) with
  `assignedTo` and `status` fields per person.
- **Geofencing**: `react-leaflet-draw` or `leaflet-draw` for drawing
  polygons on `LeafletMap.jsx`, `@turf/turf` for point-in-polygon and
  splitting the operating area between the two drones.

Everything stays inside this one project — no separate files to keep
in sync.
