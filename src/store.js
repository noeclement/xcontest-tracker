/**
 * In-memory store for flight data and pilot info.
 */

const MAX_HISTORY = 60; // keep last 60 fixes (~30 min at 30s interval)

export class PilotStore {
  constructor() {
    /** @type {Map<string, object>} Flight data by UUID */
    this.flights = new Map();
    /** @type {Map<string, object>} Static info by UUID */
    this.statics = new Map();
    /** @type {Map<string, Array>} Fix history by UUID: [{ t, alt, agl, lat, lon }] */
    this.history = new Map();
  }

  /** Update flight data and record fix history. */
  updateFlights(info) {
    for (const [uuid, data] of Object.entries(info)) {
      this.flights.set(uuid, data);

      // Record fix in history
      const fix = data.lastFix;
      if (!fix) continue;

      const t = fix[3]?.t;
      const alt = fix[2];
      const groundAlt = fix[3]?.g;
      const agl = alt != null && groundAlt != null ? alt - groundAlt : null;

      if (!this.history.has(uuid)) this.history.set(uuid, []);
      const hist = this.history.get(uuid);

      // Only add if timestamp changed
      if (hist.length === 0 || hist[hist.length - 1].t !== t) {
        hist.push({ t, alt, agl, lat: fix[1], lon: fix[0] });
        if (hist.length > MAX_HISTORY) hist.shift();
      }
    }
  }

  /** Update static info (pilot, glider, takeoff...). */
  updateStatics(info) {
    for (const [uuid, data] of Object.entries(info)) {
      this.statics.set(uuid, data);
    }
  }

  /** Search a pilot by name or username (partial, case-insensitive). */
  search(query) {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results = [];

    for (const [uuid, info] of this.statics) {
      const name = (info.user?.fullname || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const username = (info.user?.username || '').toLowerCase();

      if (name.includes(q) || username.includes(q)) {
        results.push(this.getPilot(uuid));
      }
    }

    return results;
  }

  /** Altitude gain/loss over ~1 min (lastFix vs lastScorePoint). */
  _altGain1m(f) {
    if (!f?.lastFix || !f?.lastScorePoint) return null;
    const fixAlt = f.lastFix[2];
    const scoreAlt = f.lastScorePoint[2];
    if (fixAlt == null || scoreAlt == null) return null;
    const fixTime = f.lastFix[3]?.t;
    const scoreTime = f.lastScorePoint[3]?.t;
    if (!fixTime || !scoreTime || fixTime === scoreTime) return null;
    return fixAlt - scoreAlt;
  }

  /** Compute vario (m/s) from recent fix history. */
  getVario(uuid) {
    const hist = this.history.get(uuid);
    if (!hist || hist.length < 2) return null;

    // Use last two fixes with valid timestamps
    const latest = hist[hist.length - 1];
    const prev = hist[hist.length - 2];

    if (!latest.t || !prev.t || latest.alt == null || prev.alt == null) return null;

    const dt = (new Date(latest.t) - new Date(prev.t)) / 1000; // seconds
    if (dt <= 0 || dt > 300) return null; // ignore stale gaps

    return (latest.alt - prev.alt) / dt;
  }

  /** Get AGL history for sparkline graph. */
  getAglHistory(uuid) {
    const hist = this.history.get(uuid);
    if (!hist) return [];
    return hist.map(h => h.agl).filter(v => v != null);
  }

  /** Get altitude history for sparkline graph. */
  getAltHistory(uuid) {
    const hist = this.history.get(uuid);
    if (!hist) return [];
    return hist.map(h => h.alt).filter(v => v != null);
  }

  /** Return a combined pilot object (static + flight) for a UUID. */
  getPilot(uuid) {
    const s = this.statics.get(uuid);
    const f = this.flights.get(uuid);
    if (!s) return null;

    const fix = f?.lastFix;
    return {
      uuid,
      name: s.user?.fullname,
      username: s.user?.username,
      nationality: s.user?.nationality?.iso,
      glider: s.glider,
      takeoff: s.takeoff?.name,
      country: s.country?.iso,
      lon: fix?.[0],
      lat: fix?.[1],
      alt: fix?.[2],
      altBaro: fix?.[3]?.b,
      groundAlt: fix?.[3]?.g,
      time: fix?.[3]?.t,
      landed: f?.landed ?? null,
      distance: f?.absDistance,
      routeDistance: f?.contest?.live9999?.route?.distance,
      avgSpeed: f?.contest?.live9999?.route?.avgSpeed,
      wind: f?.addInfo?.windFromMs,
      altGain1m: this._altGain1m(f),
      vario: this.getVario(uuid),
      aglHistory: this.getAglHistory(uuid),
      altHistory: this.getAltHistory(uuid),
    };
  }

  /** List all flying (not landed) pilots. */
  listFlying() {
    const flying = [];
    for (const [uuid] of this.statics) {
      const f = this.flights.get(uuid);
      if (f && !f.landed) {
        flying.push(this.getPilot(uuid));
      }
    }
    return flying.sort((a, b) => (b.distance || 0) - (a.distance || 0));
  }

  /** List all known pilots. */
  listAll() {
    const all = [];
    for (const [uuid] of this.statics) {
      all.push(this.getPilot(uuid));
    }
    return all.sort((a, b) => (b.distance || 0) - (a.distance || 0));
  }

  get size() {
    return this.statics.size;
  }
}
