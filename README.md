# LinkedIn Network Analyzer

Interactive network visualization tool that maps your LinkedIn connections into an explorable bubble graph. Identify key players, company relationships, and influential contacts across your professional network.

All data stays local — no server, no account, no tracking. Runs entirely in your browser with SQLite persisted to IndexedDB.

## Features

### Visualization
- **D3.js Bubble Graph** — Companies rendered as bubbles sized by estimated employee count, contacts orbit their companies
- **Galaxy Effect** — Your own company is rendered as a glowing sun with zoom-responsive corona
- **Click-to-Focus** — Click any company bubble to dim unrelated nodes and highlight its connections
- **Zoom & Pan** — Navigate large networks with smooth zoom, click search results or connections to fly to them
- **Performance Optimized** — Handles 1000+ contacts with throttled rendering and zoom-based detail levels

### Data & Import
- **LinkedIn CSV Import** — Upload your `Connections.csv` export directly from LinkedIn
- **Manual Contacts** — Add contacts and companies manually
- **Influence Scoring** — Ranks contacts by seniority, company reach, network density, role relevance, and recency
- **Industry Classification** — Auto-detects industries from company names and positions (DE/EN)

### Company Relationships
- **Relationship Mapping** — Define customer, partner, investor, lead, and competitor links between companies
- **Directional Arrows** — Curved arrows with color-coded relationship types on the graph
- **Clickable Connections** — Click a relationship in the sidebar to zoom to the connected company
- **Inferred Connections** — Auto-detects likely company relationships based on shared contacts and business roles

### Sidebar & Filtering
- **Tabbed Sidebar** — Default view with Influencer and Firmen tabs; company detail view with Info, Links, and Kontakte tabs
- **Range Sliders** — Dual-thumb sliders to filter influencers by score and companies by employee count
- **Top-Bar Filters** — Filter by minimum contacts per company, seniority level, industry, and link type
- **Direkt Toggle** — Force-show companies connected to yours regardless of other filters
- **Unbekannt Group** — Contacts without a company are collected in a placeholder bubble

### Management
- **Company Editing** — Rename companies, adjust estimated size, set industry, change your company's bubble color
- **Search with Navigation** — Search contacts and companies, click to pan/zoom directly to their bubble
- **Settings & Account Management** — Delete account and re-onboard from the settings panel

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

1. **Onboarding** — Enter your name, company, and industry; protected by a local password
2. **Import** — Upload your LinkedIn `Connections.csv` (or add contacts manually)
3. **Explore** — Zoom, pan, search, and click bubbles to navigate your network
4. **Connect** — Define relationships between companies (customer, partner, investor, lead, competitor)
5. **Analyze** — Use sidebar tabs, range sliders, and top-bar filters to surface insights

## Privacy

All data is stored locally in your browser via IndexedDB. Nothing is sent to any server. Your LinkedIn data never leaves your machine.
