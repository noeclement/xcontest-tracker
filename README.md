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

Change refresh interval (default 30s):

```bash
xct "MaxP" --interval 10
```

The tracker keeps running even if the pilot isn't live yet — you'll get a **native OS notification with sound** when:
- The pilot appears in live tracking
- The pilot takes off (status changes from landed to flying)

Works on macOS (Notification Center), Windows (Toast notifications), and Linux (`notify-send`).

### List flying pilots

```bash
xct --list
```

Displays a table sorted by distance flown, refreshed every 30s.

### Search for a pilot

```bash
xct --search "Pinot"
```

Displays results and exits.

## Displayed info

For each tracked pilot:

- **Status**: flying / landed
- **GPS position** (lat, lon) with Google Maps link and XContest Live link
- **Altitude** (GPS + AGL)
- **Distance** flown (km)
- **Average speed** (km/h)
- **Wind** (direction + speed)
- **Glider**, takeoff site, country
- **Last fix** timestamp

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
