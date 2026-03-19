/**
 * Terminal display and formatting functions.
 */

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

export function formatPilot(p) {
  if (!p) return '  Pilot not found.\n';

  const status = p.landed === false
    ? c('green', 'FLYING')
    : p.landed === true
      ? c('red', 'LANDED')
      : c('dim', 'UNKNOWN');

  const wind = p.wind
    ? `${p.wind[0]}deg / ${(p.wind[1] * 3.6).toFixed(1)} km/h`
    : '-';

  const altAGL = p.alt != null && p.groundAlt != null
    ? ` (${p.alt - p.groundAlt} m AGL)`
    : '';

  const lines = [
    '',
    c('bold', `  ${p.name}`) + c('dim', ` @${p.username}`) + `  ${status}`,
    c('dim', `  ${p.glider || '?'}  |  Takeoff: ${p.takeoff || '?'} (${p.country || '?'})`),
    '',
    `  Position   ${c('cyan', `${p.lat?.toFixed(5) ?? '?'}, ${p.lon?.toFixed(5) ?? '?'}`)}`,
    `  Altitude   ${p.alt ?? '?'} m GPS${altAGL}`,
    `  Distance   ${p.routeDistance?.toFixed(1) ?? p.distance ?? '?'} km`,
    `  Avg speed  ${p.avgSpeed ?? '?'} km/h`,
    `  Wind       ${wind}`,
    `  Last fix   ${c('dim', p.time ?? '?')}`,
    c('dim', `  https://www.google.com/maps?q=${p.lat},${p.lon}`),
    '',
  ];

  return lines.join('\n');
}

export function formatPilotCompact(p) {
  if (!p) return '';
  const status = p.landed === false ? c('green', 'FLY') : c('red', 'LND');
  const dist = (p.distance ?? 0).toFixed(1).padStart(6);
  const alt = String(p.alt ?? 0).padStart(5);
  return `  ${status}  ${c('bold', p.name?.padEnd(25) || '?')} ${alt} m  ${dist} km  ${c('dim', p.glider || '')}`;
}

export function printHeader(query, count) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.clear();
  console.log(c('bgBlue', c('white', `  XCONTEST LIVE TRACKER  `)));
  console.log(c('dim', `  ${now}  |  ${count} pilots online`));
  if (query) console.log(c('dim', `  Tracking: "${query}"`));
  console.log();
}

export function printList(pilots, maxCount = 30) {
  const header = `  ${'STAT'.padEnd(5)} ${'PILOT'.padEnd(25)} ${'ALT'.padStart(5)}    ${'DIST'.padStart(6)}    GLIDER`;
  console.log(c('dim', header));
  console.log(c('dim', '  ' + '-'.repeat(78)));
  for (const p of pilots.slice(0, maxCount)) {
    console.log(formatPilotCompact(p));
  }
  if (pilots.length > maxCount) {
    console.log(c('dim', `  ... and ${pilots.length - maxCount} more`));
  }
  console.log();
}

/** Play a system bell sound. */
export function beep() {
  process.stdout.write('\x07');
}
