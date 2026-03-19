/**
 * Store en mémoire pour les données de vol et les infos pilotes.
 */
export class PilotStore {
  constructor() {
    /** @type {Map<string, object>} Données de vol par UUID */
    this.flights = new Map();
    /** @type {Map<string, object>} Infos statiques par UUID */
    this.statics = new Map();
  }

  /** Met à jour les données de vol. */
  updateFlights(info) {
    for (const [uuid, data] of Object.entries(info)) {
      this.flights.set(uuid, data);
    }
  }

  /** Met à jour les infos statiques (pilote, voile, décollage...). */
  updateStatics(info) {
    for (const [uuid, data] of Object.entries(info)) {
      this.statics.set(uuid, data);
    }
  }

  /** Recherche un pilote par nom ou username (recherche partielle, insensible à la casse). */
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

  /** Retourne un objet pilote combiné (statique + vol) pour un UUID. */
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
    };
  }

  /** Liste tous les pilotes en vol (non posés). */
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

  /** Liste tous les pilotes connus. */
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
