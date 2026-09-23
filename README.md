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
- `components/Sidebar.jsx` — fleet status cards, arm/disarm toggle.
- `components/Header.jsx` — top bar.
- `styles/globals.css` — all styling (ported from the original
  single-file dashboard).

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
