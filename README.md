# Surface Pulse

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Online-brightgreen)](https://minghanl.github.io/surface-pulse/)
[![Bluetooth](https://img.shields.io/badge/Bluetooth-Web%20BLE-blue)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
[![Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF)](https://vitejs.dev/)

<div align="center">
  <img src="SurfacePulseDemo.gif" width="700" style="border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.1);">
</div>

<br>

**Surface Pulse** turns a touchscreen into a tactile texture simulator. You arrange material
stickers (glass, wood, metal, rubber, fabric, stone, sand) on a canvas, then slide your finger
across them. The web app detects which material is under the finger and how large the contact
patch is, and streams that information over **Web Bluetooth** to a microcontroller (MCU). The MCU
drives a **PowerHap piezo haptic actuator** worn on the fingernail, producing a vibration pattern
tuned to each material — so dragging across the screen *feels* like dragging across the real surface.

```
 Finger on screen ──► Web app (material + contact area) ──BLE──► MCU ──► PowerHap actuator on nail ──► vibration
```

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [**Bluetooth Interface / Protocol**](#bluetooth-interface--protocol)  ← the important part
- [Extending the App](#extending-the-app)
- [Browser Support](#browser-support)
- [Deployment](#deployment)

---

## Features

- 🎯 **Web Bluetooth (BLE)** — pairs directly with the MCU from the browser, no native app required
- 🎨 **Drag-and-drop canvas** — drop material stickers anywhere, drag to reposition, pinch to resize
- 🧩 **Layout templates** — one-click preset arrangements (Basic / Nature / Tech / Full Set)
- 📊 **Live data monitor** — floating panel showing the current material, contact area, send rate, a rolling waveform, and a timestamped log — works even when BLE is disconnected (useful for debugging)
- ✏️ **Edit mode** — lock/unlock stickers for dragging and pinch-resizing
- 🕶️ **Blind mode** — hides the sticker images (renders them as plain discs) for haptics-only experiments
- 📱 **Touch + mouse** — full support for iPhone/iPad touch and desktop Chrome mouse

---

## How It Works

1. **Place materials.** Drag stickers from the side drawer onto the canvas, or load a template.
2. **Touch detection.** As the finger (or mouse) moves over the canvas, `TouchDetector` runs a
   circular hit-test against every sticker to find the material under the contact point, and
   estimates the **contact area** from the touch radius (`π · radiusX · radiusY`).
3. **Transmit.** On every touch/move, `Canvas` calls `BluetoothManager.send(materialId, area)`,
   which packs the data into a small JSON message and writes it to the MCU over BLE.
4. **Haptics.** The MCU parses the message and drives the PowerHap actuator with the vibration
   profile mapped to that material. When the finger lifts, the app sends `material: "none"` so the
   MCU stops the vibration.

---

## Project Structure

```
SurfacePulse/
├── index.html              # Page skeleton (topbar, canvas, drawer, data monitor)
├── vite.config.js          # Vite config (dev server + GitHub Pages base path)
├── package.json
├── public/
│   └── materials/          # Material sticker images (glass.png, wood.png, ...)
└── src/
    ├── main.js             # App entry — wires all modules together
    ├── bluetooth/
    │   └── BluetoothManager.js   # ★ BLE connection + data transmission (the interface)
    ├── touch/
    │   └── TouchDetector.js      # Touch/mouse input → material hit-test + contact area
    ├── components/
    │   ├── Canvas.js             # Orchestrator: stickers, touch events, BLE dispatch
    │   ├── MaterialSticker.js    # A single sticker (drag, pinch-resize, delete)
    │   ├── MaterialDrawer.js     # Side drawer: palette + templates, drag-to-canvas
    │   └── DataMonitor.js        # Live floating debug/monitor panel
    ├── data/
    │   ├── materials.js          # Material registry — add/edit materials here
    │   └── templates.js          # Layout-template registry
    └── styles/
        └── main.css
```

**Module relationships:**

```
main.js
  ├── BluetoothManager ──────────────┐  (BLE I/O)
  ├── Canvas ── TouchDetector        │  (input + hit-test)
  │        └── MaterialSticker       │
  │        └── sends to ─────────────┘
  ├── MaterialDrawer ── Canvas       (drag stickers / load templates)
  └── DataMonitor ◄── BluetoothManager.onSend  (mirrors every send)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- A BLE-capable host running a **Web Bluetooth-enabled browser** (see [Browser Support](#browser-support))
- An MCU exposing a **Nordic UART Service** (see the [protocol](#bluetooth-interface--protocol))

### Install & run

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (http://localhost:5173)
```

The dev server binds to `host: true`, so a phone/iPad on the same network can reach it at
`http://<your-computer-ip>:5173`.

> **Note:** Web Bluetooth requires a **secure context** — `https://` or `localhost`. The hosted
> GitHub Pages build is served over HTTPS. On a phone hitting the LAN dev server over plain
> `http://<ip>`, BLE pairing may be blocked by the browser; use the deployed HTTPS URL for on-device testing.

### Build

```bash
npm run build    # output to dist/
npm run preview  # preview the production build locally
npm run deploy   # build + publish dist/ to GitHub Pages
```

---

## Usage

1. Open the app and tap the **Bluetooth status** chip in the top bar to pair with your MCU.
2. Open the **side drawer** (the tab on the right edge) and drag material stickers onto the canvas,
   or tap a **template** to load a preset layout.
3. Toggle **Edit mode** (✏️) to drag stickers around or pinch-resize them; toggle it off to lock them.
4. Slide your finger across the canvas. Watch the **data monitor** for the live material, contact
   area, and send rate. The MCU/actuator vibrates according to the material under your finger.
5. Use **Blind mode** (🕶️) to hide the images and test recognition by haptics alone.

---

## Bluetooth Interface / Protocol

> This is the contract between the web app and your firmware. Implement the matching side on the
> MCU and the system works end-to-end. All BLE logic lives in
> [`src/bluetooth/BluetoothManager.js`](src/bluetooth/BluetoothManager.js).

### Transport

- **API:** [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) (GATT client; the browser is the **central**, the MCU is the **peripheral**).
- **Service:** **Nordic UART Service (NUS)** — a widely supported BLE serial-emulation profile
  (nRF52, HC-08, and many other modules implement it out of the box).
- **Direction:** one-way, app → MCU (write only). The app does **not** subscribe to notifications.
- **Write type:** `writeValueWithoutResponse` (no GATT ack) — chosen for low latency under the
  high-frequency stream of touch-move events.

### GATT UUIDs

| Role | UUID | Purpose |
|------|------|---------|
| **Service** (NUS) | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | UART service identifier |
| **TX Characteristic** (write) | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | App → MCU data channel |

> These are the standard Nordic UART UUIDs. If your firmware uses a different service, change
> `SERVICE_UUID` and `TX_CHARACTERISTIC` at the top of
> [`BluetoothManager.js`](src/bluetooth/BluetoothManager.js#L36-L44).

### Connection flow

1. App calls `navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [SERVICE_UUID] })` → the browser shows a device picker.
2. App connects to the GATT server: `device.gatt.connect()`.
3. App resolves the service and the TX characteristic by UUID.
4. App listens for `gattserverdisconnected` to detect power-loss / out-of-range and reset state.

Status is surfaced to the UI as one of `disconnected` | `connecting` | `connected`.

### Message format

Each message is a **UTF-8-encoded JSON string** written to the TX characteristic. There is **no
framing, length prefix, or delimiter** added by the app — each BLE write carries exactly one JSON
object. (If your firmware reassembles a byte stream, treat each `}` as a record boundary, or have
firmware buffer per-write.)

```jsonc
{ "material": "glass", "area": 1234 }   // finger over the glass sticker, ~1234 px² contact patch
{ "material": "none",  "area": 0 }       // finger lifted / over empty canvas → stop vibration
```

| Field | Type | Description |
|-------|------|-------------|
| `material` | `string` | Material ID under the contact point, or `"none"` when there's no material / the finger is released. See the [material IDs](#material-ids) below. |
| `area` | `number` | Integer estimated contact area in **square pixels** (`Math.round`ed). Derived from the touch radii: `π · radiusX · radiusY`. With a mouse there is no real radius, so a fixed ~`π·10·10 ≈ 314 px²` is sent. Use it as a relative pressure/contact proxy, not an absolute physical unit. |

### Send timing & frequency

- A message is sent on **every** `touchstart` / `touchmove` (and mouse equivalent) — i.e. a
  continuous high-rate stream (tens of messages/sec) while the finger is moving. The data monitor
  shows the live messages-per-second rate.
- Exactly **one** `{"material":"none","area":0}` is sent on release (`touchend` / mouse up).
- Messages are sent **regardless of connection state**: when BLE is disconnected the payload is
  still mirrored to the data monitor (for local debugging) but not written to any characteristic.

### Material IDs

The `material` field is one of the registry IDs (from [`src/data/materials.js`](src/data/materials.js)),
or `"none"`:

| ID | Label |
|----|-------|
| `glass` | Glass |
| `wood` | Wood |
| `metal` | Metal |
| `rubber` | Rubber |
| `fabric` | Fabric |
| `stone` | Stone |
| `sand` | Sand |
| `none` | *(no material / released)* |

Your firmware maps each ID to a PowerHap vibration waveform. Adding a material in `materials.js`
introduces a new ID over the wire — keep the firmware's material→waveform table in sync.

### Firmware-side checklist

1. Advertise the **Nordic UART Service** with the UUIDs above.
2. Accept writes (without response) on the **TX** characteristic.
3. Parse each write as a UTF-8 JSON object `{ material, area }`.
4. Map `material` → a PowerHap waveform; optionally scale intensity by `area`.
5. On `material: "none"`, stop the actuator.

### Minimal client snippet (for reference)

```js
const SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const TX      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const device = await navigator.bluetooth.requestDevice({
  acceptAllDevices: true,
  optionalServices: [SERVICE],
});
const server  = await device.gatt.connect();
const service = await server.getPrimaryService(SERVICE);
const txChar  = await service.getCharacteristic(TX);

const payload = JSON.stringify({ material: 'glass', area: 1234 });
await txChar.writeValueWithoutResponse(new TextEncoder().encode(payload));
```

---

## Extending the App

### Add a material

1. Drop the image into `public/materials/<name>.png`.
2. Append one object to `MATERIALS` in [`src/data/materials.js`](src/data/materials.js):

   ```js
   { id: 'leather', label: 'Leather', image: 'materials/leather.png', color: '#8B5A2B', size: 100 }
   ```

   - `id` — the value sent over BLE; must be unique and matched by firmware.
   - `label` — shown on the sticker and in the monitor.
   - `image` — path relative to `public/`.
   - `color` — accent color for monitor dots/text.
   - `size` — default sticker diameter (px); also the minimum pinch-resize size.

   It appears in the drawer automatically.

### Add a template

Append to `TEMPLATES` in [`src/data/templates.js`](src/data/templates.js). Positions are fractions
of the canvas (`xPct`/`yPct` from `0.0`–`1.0`) so layouts scale across screen sizes:

```js
{
  id: 'mix', name: 'Mix', description: 'Glass · Sand',
  stickers: [
    { materialId: 'glass', xPct: 0.30, yPct: 0.40 },
    { materialId: 'sand',  xPct: 0.70, yPct: 0.50 },
  ],
}
```

---

## Browser Support

Web Bluetooth is required, and only available in a **secure context** (HTTPS or `localhost`).

| Platform | Browser |
|----------|---------|
| Windows / macOS / Linux / Android | **Google Chrome** (or other Chromium browsers) |
| iOS / iPadOS | **Bluefy** or **WebBLE** (Safari does *not* support Web Bluetooth) |

If `navigator.bluetooth` is unavailable, the app alerts the user with these recommendations.

---

## Deployment

The app is configured for **GitHub Pages**. The repo name is baked into `vite.config.js`:

```js
base: '/surface-pulse/',   // must match your repository name
```

Publish with:

```bash
npm run deploy   # builds and pushes dist/ to the gh-pages branch
```

If you fork/rename the repo, update `base` accordingly.
