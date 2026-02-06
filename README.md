# LinkedIn Network Analyzer

Interactive network visualization tool that maps your LinkedIn connections into an explorable bubble graph. Identify key players, company relationships, and influential contacts across your professional network.

All data stays local — no server, no account, no tracking. Runs entirely in your browser with SQLite persisted to IndexedDB.

## Features

- **D3.js Bubble Visualization** — Companies rendered as bubbles sized by estimated employee count, contacts orbit their companies
- **LinkedIn CSV Import** — Upload your `Connections.csv` export directly from LinkedIn
- **Influence Scoring** — Ranks contacts by position seniority and company reach
- **Company Relationships** — Map customer, supplier, partner, investor, and competitor links with directional arrows
- **Key Player Highlighting** — Select a company to see its most senior contacts highlighted on the graph and in the sidebar
- **Search with Navigation** — Search contacts and companies, click to pan/zoom directly to their bubble
- **Company Editing** — Rename companies, adjust estimated size, set industry, change your company's bubble color
- **Galaxy Effect** — Your own company is rendered as a glowing sun with zoom-responsive corona
- **Seniority & Size Filters** — Filter by minimum company size and contact seniority level
- **Settings & Account Management** — Delete account and re-onboard from the settings panel
- **Performance Optimized** — Handles 1000+ contacts with throttled rendering and zoom-based detail levels

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`

## Build

```bash
npm run build
```

Output in `/dist` — deploy as a static site.

## Tech Stack

- **React 18** — UI components and state management
- **D3.js** — Force simulation and SVG rendering
- **sql.js** — SQLite compiled to WASM, loaded from CDN
- **IndexedDB** — Browser-local persistence
- **Vite** — Build tool and dev server

## How It Works

1. **Onboarding** — Enter your name, company, and industry
2. **Import** — Upload your LinkedIn `Connections.csv` (or add contacts manually)
3. **Explore** — Zoom, pan, search, and click to navigate your network
4. **Analyze** — Use filters, company links, and key player highlights to find insights

## Privacy

All data is stored locally in your browser via IndexedDB. Nothing is sent to any server. Your LinkedIn data never leaves your machine.
