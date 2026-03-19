/**
 * Terminal display and formatting functions.
 */

import { exec } from 'node:child_process';

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
  bgRed: '\x1b[41m',
};

const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

/** Render a sparkline from an array of numbers. */
function sparkline(values, width = 30) {
  if (!values.length) return '';
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Resample to width if needed
  let data = values;
  if (values.length > width) {
    data = [];
    for (let i = 0; i < width; i++) {
      const idx = Math.round(i * (values.length - 1) / (width - 1));
      data.push(values[idx]);
    }
  }

  const spark = data.map(v => chars[Math.min(7, Math.floor((v - min) / range * 7))]).join('');
  return `${spark} ${c('dim', `${min}–${max} m`)}`;
}

/** Convert a bearing (degrees) to a Unicode arrow pointing that direction. */
function bearingArrow(deg) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(deg / 45) % 8];
}

/** Convert wind direction (degrees, "from") to an arrow showing where the wind blows. */
function windArrow(deg) {
  // Wind FROM 0° (north) blows south → rotate 180°
  return bearingArrow((deg + 180) % 360);
}

/** Format altitude gain over 1 min with color and arrow. */
function formatAltGain(meters) {
  if (meters == null) return '-';
  const arrow = meters >= 0 ? '↗' : '↘';
  const str = `${arrow} ${Math.abs(meters)} m/min`;
  if (meters >= 5) return c('green', str);
  if (meters <= -5) return c('red', str);
  return c('dim', str);
}

export function formatPilot(p, { lowAlt = 150 } = {}) {
  if (!p) return '  Pilot not found.\n';

  const status = p.landed === false
    ? c('green', 'FLYING')
    : p.landed === true
      ? c('red', 'LANDED')
      : c('dim', 'UNKNOWN');

  const wind = p.wind
    ? `${windArrow(p.wind[0])} ${(p.wind[1] * 3.6).toFixed(1)} km/h (${p.wind[0]}°)`
    : '-';

  const agl = p.alt != null && p.groundAlt != null ? p.alt - p.groundAlt : null;
  const isLow = agl != null && agl < lowAlt && p.landed === false && (p.distance ?? 0) >= 3;
  const aglColor = isLow ? 'red' : 'bold';
  const aglLabel = `${agl ?? '?'} m AGL` + (isLow ? ' !!!' : '');

  const aglHist = p.aglHistory || [];
  const aglGraph = aglHist.length >= 2
    ? `  AGL graph  ${sparkline(aglHist)}`
    : null;

  const dangerBar = isLow
    ? c('red', '  !! LOW POINT !!')
    : null;

  const lines = [
    c('dim', '  ─────────────────────────────────────────────'),
    dangerBar,
    '',
    c('bold', `  ${p.name}`) + c('dim', ` @${p.username}`) + `  ${status}`,
    c('dim', `  ${p.glider || '?'}  |  Takeoff: ${p.takeoff || '?'} (${p.country || '?'})`),
    '',
    `  ${c(aglColor, aglLabel)}  ${c('dim', `(${p.alt ?? '?'} m GPS / gnd ${p.groundAlt ?? '?'} m)`)}`,
    '',
    `  Climb/1m   ${formatAltGain(p.altGain1m)}`,
    `  Vario      ${p.vario != null ? (p.vario >= 0.5 ? c('green', `+${p.vario.toFixed(1)} m/s`) : p.vario <= -0.5 ? c('red', `${p.vario.toFixed(1)} m/s`) : c('dim', `${p.vario >= 0 ? '+' : ''}${p.vario.toFixed(1)} m/s`)) : '-'}`,
    '',
    `  Distance   ${p.routeDistance?.toFixed(1) ?? p.distance ?? '?'} km`,
    `  Avg speed  ${p.avgSpeed ?? '?'} km/h`,
    `  Wind       ${wind}`,
    `  Heading    ${p.heading != null ? `${bearingArrow(p.heading)} (${Math.round(p.heading)}°)` : '-'}`,
    '',
    `  Last fix   ${c('dim', p.time ?? '?')}`,
    aglGraph,
    '',
    p.lat != null ? c('dim', `  https://www.google.com/maps?q=${p.lat},${p.lon}`) : null,
    '',
  ];

  return lines.filter(l => l != null).join('\n');
}

export function formatPilotCompact(p) {
  if (!p) return '';
  const status = p.landed === false ? c('green', 'FLY') : c('red', 'LND');
  const dist = (p.distance ?? 0).toFixed(1).padStart(6);
  const agl = p.alt != null && p.groundAlt != null ? p.alt - p.groundAlt : 0;
  const alt = String(agl).padStart(5);
  const climb = p.altGain1m != null ? formatAltGain(p.altGain1m) : '';
  return `  ${status}  ${c('bold', p.name?.padEnd(25) || '?')} ${alt} m  ${dist} km  ${climb}  ${c('dim', p.glider || '')}`;
}

export function printHeader(query, count) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.clear();
  console.log(c('bgBlue', c('white', `  XCONTEST LIVE TRACKER  `)) + c('dim', `  https://live.xcontest.org`));
  console.log(c('dim', `  ${now}  |  ${count} pilots online`));
  if (query) console.log(c('dim', `  Tracking: "${query}"`));
  console.log();
}

export function printList(pilots, maxCount = 30) {
  const header = `  ${'STAT'.padEnd(5)} ${'PILOT'.padEnd(25)} ${'AGL'.padStart(5)}    ${'DIST'.padStart(6)}    CLIMB        GLIDER`;
  console.log(c('dim', header));
  console.log(c('dim', '  ' + '-'.repeat(85)));
  for (const p of pilots.slice(0, maxCount)) {
    console.log(formatPilotCompact(p));
  }
  if (pilots.length > maxCount) {
    console.log(c('dim', `  ... and ${pilots.length - maxCount} more`));
  }
  console.log();
}

/** Send an OS notification + sound (cross-platform, no dependencies). */
export function notify(title, body) {
  const platform = process.platform;
  const t = title.replace(/'/g, "'\\''");
  const b = body.replace(/'/g, "'\\''");

  if (platform === 'darwin') {
    exec(`osascript -e 'display notification \"${b}\" with title \"${t}\" sound name \"Glass\"'`);
  } else if (platform === 'win32') {
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
      $t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0);
      $t.GetElementsByTagName('text')[0].AppendChild($t.CreateTextNode('${t}: ${b}')) | Out-Null;
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('XContest Tracker').Show([Windows.UI.Notifications.ToastNotification]::new($t));
      [System.Media.SystemSounds]::Exclamation.Play()
    `.replace(/\n\s*/g, ' ');
    exec(ps, { shell: 'powershell.exe' });
  } else {
    // Linux: notify-send + sound
    exec(`notify-send '${t}' '${b}' 2>/dev/null`);
    exec(
      'paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || ' +
      'aplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || ' +
      'printf "\\a"'
    );
  }
}
