#!/usr/bin/env node

import { XContestClient } from './client.js';
import { PilotStore } from './store.js';
import { formatPilot, printHeader, printList, notify } from './display.js';

// ─── Argument parsing ───────────────────────────────────────────────────────

function printUsage() {
  console.log(`
  Usage:
    xct "Pilot name or username"       Track a pilot (refreshes every 10s)
    xct "Pilot" --interval 10          Change refresh interval (seconds)
    xct "Pilot" --low-alt 200         Set low point alert threshold (default: 150m AGL)
    xct "Pilot" --notify-km 50        Notify every 50 km flown (default: off)
    xct --list                         List flying pilots
    xct --search "text"                Search for a pilot

  Examples:
    xct "Maxime Pinot"
    xct "MaxP"
    xct --list
    xct --search "Pinot"
  `);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  printUsage();
  process.exit(0);
}

const listMode = args.includes('--list');
const searchIdx = args.indexOf('--search');
const intervalIdx = args.indexOf('--interval');

const lowAltIdx = args.indexOf('--low-alt');
const notifyKmIdx = args.indexOf('--notify-km');

const searchQuery = searchIdx !== -1 ? args[searchIdx + 1] : null;
const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1]) : 10;
const lowAltThreshold = lowAltIdx !== -1 ? parseInt(args[lowAltIdx + 1]) : null;
const notifyKmStep = notifyKmIdx !== -1 ? parseInt(args[notifyKmIdx + 1]) : null;

// In track mode, the first non-flag argument is the pilot name
let trackQuery = null;
if (!listMode && !searchQuery) {
  trackQuery = args.find(a => !a.startsWith('--'));
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const store = new PilotStore();
let ready = false;
let gotFlights = false;
let gotStatics = false;

// Track previous state for notifications
let prevFound = false;
let prevFlying = false;

// ─── Low point detector (Schmitt trigger / hysteresis) ──────────────────────

const LOW_AGL = lowAltThreshold || 150;  // alert threshold (m)
const SAFE_AGL = LOW_AGL * 2;           // reset threshold (m)
const MIN_DISTANCE = 3;    // ignore during takeoff/extraction (km)

// State per pilot username: 'safe' | 'low'
const lowPointState = new Map();

function checkLowPoint(p) {
  if (!p || p.landed !== false) return;

  const agl = p.alt != null && p.groundAlt != null ? p.alt - p.groundAlt : null;
  if (agl == null) return;

  // Skip takeoff/extraction phase
  if ((p.distance ?? 0) < MIN_DISTANCE) return;

  const key = p.username || p.uuid;
  const state = lowPointState.get(key) || 'safe';

  if (state === 'safe' && agl < LOW_AGL) {
    lowPointState.set(key, 'low');
    notify('Low Point!', `${p.name} is at ${agl} m AGL!`);
    console.log(`  *** LOW POINT: ${p.name} at ${agl} m AGL! ***\n`);
  } else if (state === 'low' && agl >= SAFE_AGL) {
    lowPointState.set(key, 'safe');
  }
}

// ─── Distance milestone detector ────────────────────────────────────────────

// Tracks last milestone reached per pilot username
const lastMilestone = new Map();

function checkDistanceMilestone(p) {
  if (!notifyKmStep || !p || p.landed !== false) return;

  const dist = p.distance ?? 0;
  if (dist < notifyKmStep) return;

  const key = p.username || p.uuid;
  const currentMilestone = Math.floor(dist / notifyKmStep) * notifyKmStep;
  const prev = lastMilestone.get(key) || 0;

  if (currentMilestone > prev) {
    lastMilestone.set(key, currentMilestone);
    // Skip notification on first detection (avoid spam on startup)
    if (lastMilestone.has(key + ':init')) {
      notify(`${currentMilestone} km!`, `${p.name} passed ${currentMilestone} km!`);
      console.log(`  *** ${p.name} passed ${currentMilestone} km! ***\n`);
    }
  }
  lastMilestone.set(key + ':init', true);
}

function checkReady() {
  if (!ready && gotFlights && gotStatics) {
    ready = true;
    onReady();
  }
}

const client = new XContestClient({
  onConnect: () => {
    console.log('  Connected to XContest Live. Loading data...\n');
  },
  onPilots: (info) => {
    store.updateFlights(info);
    gotFlights = true;
    checkReady();
  },
  onStatic: (info) => {
    store.updateStatics(info);
    gotStatics = true;
    checkReady();
  },
  onError: (err) => {
    console.error(`  Error: ${err.message}`);
  },
  onClose: () => {
    if (ready) console.log('  Disconnected. Reconnecting...');
  },
});

// ─── Actions ────────────────────────────────────────────────────────────────

function onReady() {
  if (listMode) {
    doList();
    setInterval(doList, interval * 1000);
  } else if (searchQuery) {
    doSearch(searchQuery);
    client.close();
    process.exit(0);
  } else if (trackQuery) {
    doTrack(trackQuery);
    setInterval(() => doTrack(trackQuery), interval * 1000);
  }
}

function doList() {
  const flying = store.listFlying();
  printHeader(null, store.size);
  console.log(`  ${flying.length} pilots flying:\n`);
  printList(flying, 50);
}

function doSearch(query) {
  const results = store.search(query);
  printHeader(null, store.size);
  if (results.length === 0) {
    console.log(`  No pilot found for "${query}"\n`);
  } else {
    console.log(`  ${results.length} result(s) for "${query}":\n`);
    for (const p of results) {
      console.log(formatPilot(p, { lowAlt: LOW_AGL }));
    }
  }
}

function doTrack(query) {
  const results = store.search(query);
  printHeader(query, store.size);

  const nowFound = results.length > 0;
  const nowFlying = results.some(p => p.landed === false);

  // Notify: pilot just appeared in live
  if (nowFound && !prevFound) {
    const name = results[0].name;
    notify('Pilot Detected', `${name} is now live!`);
    console.log(`  *** PILOT DETECTED: ${name} is now live! ***\n`);
  }

  // Notify: pilot just took off (was landed, now flying)
  if (nowFlying && !prevFlying && prevFound) {
    const name = results.find(p => !p.landed)?.name;
    notify('Takeoff!', `${name} is in the air!`);
    console.log(`  *** TAKEOFF: ${name} is in the air! ***\n`);
  }

  prevFound = nowFound;
  prevFlying = nowFlying;

  if (results.length === 0) {
    console.log(`  No pilot found for "${query}".`);
    console.log(`  Waiting for pilot to appear... (checking every ${interval}s)\n`);
    return;
  }

  for (const p of results) {
    checkLowPoint(p);
    checkDistanceMilestone(p);
    console.log(formatPilot(p, { lowAlt: LOW_AGL }));
  }

  console.log(`\n  Next update in ${interval}s (Ctrl+C to quit)\n`);
}

// ─── Go ─────────────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n  Bye!\n');
  client.close();
  process.exit(0);
});

client.connect();
