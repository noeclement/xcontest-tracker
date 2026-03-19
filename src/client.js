import { createHmac } from 'node:crypto';
import WebSocket from 'ws';

const WS_URL = 'wss://live2.xcontest.org/websock/webclient';
const HMAC_KEY = 'bjIsOZnTlI5ktxO7uGTmJyfxBIonEtrwFPIaePVPPcAKj9YNlrm2TItjePlPySkD';

/**
 * WebSocket client for the XContest Live Tracking API.
 * Handles the HMAC-SHA256 handshake, subscription, and pilot data reception.
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

  /** Open the WebSocket connection. */
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
      // Server sends the challenge first, we wait.
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
        // Ignore non-JSON messages
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

  /** Close the connection cleanly. */
  close() {
    this._shouldReconnect = false;
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Respond to the server's HMAC-SHA256 challenge. */
  _handleChallenge(data) {
    this._initMsg = false;

    const challengeBytes = Buffer.from(data);
    const hmac = createHmac('sha256', HMAC_KEY);
    hmac.update(challengeBytes);
    const response = hmac.digest();

    this.ws.send(response);

    // Send initialization messages
    this._send({ tag: 'WebFilterArea', area: null });
    this._send({ tag: 'WebFilterContest', contents: `${this.league}${this.volume}` });
    this._send({ tag: 'WebFollow', contents: [] });

    this.onConnect();
  }

  /** Dispatch incoming server messages. */
  _dispatch(msg) {
    switch (msg.tag) {
      case 'LiveFlightInfos':
        if (msg.info) {
          // Request static info for new UUIDs
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

  /** Send a JSON message to the server. */
  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /** Request detailed info for a list of UUIDs. */
  requestInfo(uuids) {
    this._send({ tag: 'WebRequestInfo', contents: uuids });
  }
}
