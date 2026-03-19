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
