# XContest Live Tracker

Suivi en temps réel de pilotes de parapente via [XContest Live](https://live.xcontest.org/), directement dans le terminal.

Se connecte au WebSocket de XContest, récupère la position de tous les pilotes en live, et affiche les infos du pilote que tu suis avec un refresh automatique.

## Installation

```bash
git clone https://github.com/noeclement/xcontest-tracker.git
cd xcontest-tracker
npm install
npm link
```

> Requiert **Node.js 18+** (utilise `node:crypto` natif).

## Utilisation

### Suivre un pilote

```bash
xct "ElieTSD"
```

Par nom complet :

```bash
xct "Elie Teyssedou"
```

Changer l'intervalle de refresh (par défaut 30s) :

```bash
xct "ElieTSD" --interval 10
```

### Lister les pilotes en vol

```bash
xct --list
```

Affiche un tableau trié par distance parcourue, actualisé toutes les 30s.

### Rechercher un pilote

```bash
xct --search "Bottegal"
```

Affiche les résultats et quitte.

## Infos affichées

Pour chaque pilote suivi :

- **Statut** : en vol / posé
- **Position GPS** (lat, lon) avec lien Google Maps
- **Altitude** GPS et hauteur sol
- **Distance** parcourue (km)
- **Vitesse moyenne** (km/h)
- **Vent** (direction + force)
- **Voile**, décollage, pays
- **Timestamp** du dernier fix

## Fonctionnement

```
┌─────────────┐    WebSocket     ┌──────────────────┐
│  Terminal    │◄───────────────►│  live2.xcontest   │
│  (Node.js)  │   HMAC-SHA256   │    .org           │
│             │   handshake     │                   │
└─────────────┘                 └──────────────────┘
```

1. Connexion WebSocket à `wss://live2.xcontest.org/websock/webclient`
2. Réponse au challenge cryptographique (HMAC-SHA256)
3. Souscription au flux live (tous les pilotes)
4. Réception des positions (`LiveFlightInfos`) et infos pilotes (`LiveStaticInfos`)
5. Affichage et refresh à intervalle régulier

## Structure du projet

```
src/
├── index.js     # Point d'entrée CLI, parsing des arguments
├── client.js    # Client WebSocket XContest (handshake + protocol)
├── store.js     # Store en mémoire (pilotes, vols, recherche)
└── display.js   # Formatage et affichage terminal
```

## Remarques

- Aucune authentification XContest requise (données publiques du live tracking)
- Reconnexion automatique en cas de déconnexion
- La recherche est insensible à la casse et aux accents
- Seuls les pilotes actuellement en live tracking apparaissent (vol du jour)

## Licence

MIT
