# XContest Live Tracker

Real-time paragliding pilot tracking via [XContest Live](https://live.xcontest.org/), right in your terminal.

Connects to XContest's WebSocket, fetches all live pilot positions, and displays the pilot you're following with automatic refresh and sound notifications.

## Installation

```bash
git clone https://github.com/noeclement/xcontest-tracker.git
cd xcontest-tracker
npm install
npm link
```

> Requires **Node.js 18+** (uses native `node:crypto`).

## Usage

### Track a pilot

```bash
xct "MaxP"
```

By full name:

```bash
xct "Maxime Pinot"
```

Change refresh interval (default 10s):

```bash
xct "MaxP" --interval 10
```

Set a custom low point alert threshold (default 150m AGL):

```bash
xct "MaxP" --low-alt 200
```

Get notified at every distance milestone:

```bash
xct "MaxP" --notify-km 50
```

### Alerts

The tracker keeps running even if the pilot isn't live yet — you'll get a **native OS notification with sound** when:

- The pilot **appears** in live tracking
- The pilot **takes off** (status changes from landed to flying)
- The pilot **drops below the AGL threshold** (low point alert)
- The pilot **passes a distance milestone** (e.g. 50 km, 100 km, 150 km...)

The low point detector uses hysteresis to avoid spam: once triggered, it won't fire again until the pilot climbs back above 2x the threshold. It also ignores the takeoff/extraction phase (distance < 3 km).

Works on macOS (Notification Center), Windows (Toast notifications), and Linux (`notify-send`).

### List flying pilots

```bash
xct --list
```

Displays a table sorted by distance flown, refreshed every 10s.

### Search for a pilot

```bash
xct --search "Pinot"
```

Displays results and exits.

## Displayed info

For each tracked pilot:

- **Height AGL** (above ground level, prominent) with GPS altitude and ground elevation
- **Climb/1m** — altitude gained or lost over ~1 min (native XContest data)
- **Vario** — vertical speed in m/s (calculated between the last two fixes)
- **AGL sparkline** — altitude graph that builds up over the tracking session
- **Distance** flown (km)
- **Average speed** (km/h)
- **Wind** (direction + speed)
- **Glider**, takeoff site, country
- **Status**: flying / landed
- **Google Maps link** for exact position

## How it works

```
┌─────────────┐    WebSocket     ┌──────────────────┐
│  Terminal    │◄───────────────►│  live2.xcontest   │
│  (Node.js)  │   HMAC-SHA256   │    .org           │
│             │   handshake     │                   │
└─────────────┘                 └──────────────────┘
```

1. WebSocket connection to `wss://live2.xcontest.org/websock/webclient`
2. HMAC-SHA256 challenge-response handshake
3. Subscribe to the live feed (all pilots)
4. Receive positions (`LiveFlightInfos`) and pilot info (`LiveStaticInfos`)
5. Display and refresh at regular intervals

## Project structure

```
src/
├── index.js     # CLI entry point, argument parsing, notifications
├── client.js    # XContest WebSocket client (handshake + protocol)
├── store.js     # In-memory store (pilots, flights, search)
└── display.js   # Terminal formatting and display
```

## Notes

- No XContest authentication required (public live tracking data)
- Auto-reconnect on disconnection
- Search is case-insensitive and accent-insensitive
- Only pilots currently live tracking appear (today's flights)

## License

MIT
