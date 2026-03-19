#!/usr/bin/env node

import { XContestClient } from './client.js';
import { PilotStore } from './store.js';
import { formatPilot, printHeader, printList } from './display.js';

// ─── Parsing des arguments ──────────────────────────────────────────────────

function printUsage() {
  console.log(`
  Usage:
    npx xcontest-tracker "Nom du pilote"          Suivre un pilote (refresh toutes les 30s)
    npx xcontest-tracker "Nom" --interval 10       Changer l'intervalle (en secondes)
    npx xcontest-tracker --list                    Lister les pilotes en vol
    npx xcontest-tracker --search "texte"          Rechercher un pilote

  Exemples:
    node src/index.js "Elie Teyssedou"
    node src/index.js --list
    node src/index.js --search "Bottegal"
    node src/index.js "Elie" --interval 15
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

const searchQuery = searchIdx !== -1 ? args[searchIdx + 1] : null;
const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1]) : 30;

// En mode track, le premier argument non-flag est le nom du pilote
let trackQuery = null;
if (!listMode && !searchQuery) {
  trackQuery = args.find(a => !a.startsWith('--'));
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const store = new PilotStore();
let ready = false;
let gotFlights = false;
let gotStatics = false;

function checkReady() {
  if (!ready && gotFlights && gotStatics) {
    ready = true;
    onReady();
  }
}

const client = new XContestClient({
  onConnect: () => {
    console.log('  Connecté à XContest Live. Chargement des données...\n');
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
    console.error(`  Erreur: ${err.message}`);
  },
  onClose: () => {
    if (ready) console.log('  Déconnecté. Reconnexion...');
  },
});

// ─── Actions ────────────────────────────────────────────────────────────────

function onReady() {
  if (listMode) {
    doList();
    // Continue de mettre à jour
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
  console.log(`  ${flying.length} pilotes en vol:\n`);
  printList(flying, 50);
}

function doSearch(query) {
  const results = store.search(query);
  printHeader(null, store.size);
  if (results.length === 0) {
    console.log(`  Aucun pilote trouvé pour "${query}"\n`);
  } else {
    console.log(`  ${results.length} résultat(s) pour "${query}":\n`);
    for (const p of results) {
      console.log(formatPilot(p));
    }
  }
}

function doTrack(query) {
  const results = store.search(query);
  printHeader(query, store.size);

  if (results.length === 0) {
    console.log(`  Aucun pilote trouvé pour "${query}".`);
    console.log(`  Le pilote n'est peut-être pas en live actuellement.\n`);
    return;
  }

  for (const p of results) {
    console.log(formatPilot(p));
  }

  console.log(`  Prochaine mise à jour dans ${interval}s (Ctrl+C pour quitter)\n`);
}

// ─── Go ─────────────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n  Bye!\n');
  client.close();
  process.exit(0);
});

client.connect();
