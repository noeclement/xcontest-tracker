import { createHmac } from 'node:crypto';
import WebSocket from 'ws';

const WS_URL = 'wss://live2.xcontest.org/websock/webclient';
const HMAC_KEY = 'bjIsOZnTlI5ktxO7uGTmJyfxBIonEtrwFPIaePVPPcAKj9YNlrm2TItjePlPySkD';

/**
 * Client WebSocket pour l'API XContest Live Tracking.
 * Gère le handshake HMAC-SHA256, la souscription et la réception des données pilotes.
 */
export class XContestClient {
  constructor({ league = 'live', volume = 9999, onPilots, onStatic, onError, onConnect, onClose } = {}) {
    this.league = league;
    this.volume = volume;
    this.onPilots = onPilots || (() => {});
    this.onStatic = onStatic || (() => {});
    this.onError = onError || (() => {});
    this.onConnect = onConnect || (() => {});
    this.onClose = onClose || (() => {});
    this.ws = null;
    this._initMsg = true;
    this._reconnectTimer = null;
    this._shouldReconnect = true;
    this._knownUuids = new Set();
  }

  /** Ouvre la connexion WebSocket. */
  connect() {
    this._shouldReconnect = true;
    this._initMsg = true;

    this.ws = new WebSocket(WS_URL, {
      headers: {
        'Origin': 'https://live.xcontest.org',
        'User-Agent': 'Mozilla/5.0 (compatible; xcontest-tracker/1.0)',
      },
    });

    this.ws.on('open', () => {
      // Le serveur envoie le challenge en premier, on attend.
    });

    this.ws.on('message', (data) => {
      if (this._initMsg) {
        this._handleChallenge(data);
        return;
      }

      try {
        const msg = JSON.parse(data.toString());
        this._dispatch(msg);
      } catch {
        // Ignore les messages non-JSON
      }
    });

    this.ws.on('error', (err) => {
      this.onError(err);
    });

    this.ws.on('close', () => {
      this.onClose();
      if (this._shouldReconnect) {
        this._reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    });
  }

  /** Ferme la connexion proprement. */
  close() {
    this._shouldReconnect = false;
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Répond au challenge HMAC-SHA256 du serveur. */
  _handleChallenge(data) {
    this._initMsg = false;

    const challengeBytes = Buffer.from(data);
    const hmac = createHmac('sha256', HMAC_KEY);
    hmac.update(challengeBytes);
    const response = hmac.digest();

    // Envoyer la réponse binaire
    this.ws.send(response);

    // Envoyer les messages d'initialisation
    this._send({ tag: 'WebFilterArea', area: null });
    this._send({ tag: 'WebFilterContest', contents: `${this.league}${this.volume}` });
    this._send({ tag: 'WebFollow', contents: [] });

    this.onConnect();
  }

  /** Dispatche les messages reçus du serveur. */
  _dispatch(msg) {
    switch (msg.tag) {
      case 'LiveFlightInfos':
        if (msg.info) {
          // Demander les infos statiques pour les nouveaux UUIDs
          const newUuids = Object.keys(msg.info).filter(u => !this._knownUuids.has(u));
          if (newUuids.length > 0) {
            newUuids.forEach(u => this._knownUuids.add(u));
            this._send({ tag: 'WebRequestInfo', contents: newUuids });
          }
          this.onPilots(msg.info);
        }
        break;
      case 'LiveStaticInfos':
        if (msg.static) this.onStatic(msg.static);
        break;
    }
  }

  /** Envoie un message JSON au serveur. */
  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /** Demande les infos détaillées pour une liste d'UUIDs. */
  requestInfo(uuids) {
    this._send({ tag: 'WebRequestInfo', contents: uuids });
  }
}
