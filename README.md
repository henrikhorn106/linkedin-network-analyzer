# LinkedIn Network Analyzer

Interaktives Datenvisualisierungstool zur Identifizierung von Kundennetzwerken, einflussreichen Kontakten und Firmenverflechtungen.

## Features

- **Force-Directed Network Graph** – Kontakte clustern sich visuell um Firmen
- **Influence Scoring** – Berechnet aus Position-Seniority × Firmengröße
- **Firmenverflechtung** – Zeigt welche Unternehmen die meisten Kontakte beschäftigen
- **Multi-User Overlap** – Gemeinsame Connections zwischen zwei Netzwerken
- **Suche** – Nach Name, Firma oder Position

## Setup

```bash
npm install
npm run dev
```

Öffnet auf `http://localhost:3000`

## Build

```bash
npm run build
```

Output in `/dist` – ready to deploy.

## Tech Stack

- React 18
- D3.js (Force Simulation)
- Vite

## Nächste Schritte

- [ ] CSV Upload für echte LinkedIn Exports
- [ ] FastAPI Backend für Multi-User
- [ ] Betweenness Centrality als zusätzliche Metrik
- [ ] Zeitlicher Netzwerk-Aufbau (Timeline View)
- [ ] Auth + User-Accounts
