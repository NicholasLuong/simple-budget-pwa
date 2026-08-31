# Budget Pocket

Budget Pocket is a local-first monthly discretionary spending PWA. It is designed for quick manual entry on iPhone, with no bank connection, account aggregation, bills, or rollover model.

## What it does

- Tracks spending against a configurable monthly limit (default: $2,000).
- Divides that limit among customizable categories.
- Organizes plans and transactions by calendar month.
- Supports fast transaction entry, editing, duplication, filtering, and undoable deletion.
- Turns MTD pace into a concise month-end projection, weekly rhythm, category watch, and actionable spending adjustment.
- Stores all data locally in IndexedDB.
- Exports and validates versioned JSON backups.
- Works offline after its first successful load.
- Supports iPhone Add to Home Screen, safe areas, and standalone display.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Production verification:

```sh
npm test
npm run build
npm run serve
```

The preview is served at `http://localhost:4173`.

## iPhone installation

1. Open the deployed website in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch Budget Pocket from the Home Screen once while online so its application shell is cached.

After that, core budgeting, transaction management, reporting, settings, and backups work without network connectivity.

## Architecture

- React and TypeScript
- Vite and Tailwind CSS
- Local shadcn-style primitives composed from Radix UI
- Dexie and IndexedDB persistence
- Zod backup validation
- Workbox-powered PWA caching
- Vitest and fake IndexedDB tests

The version-two Dexie migration preserves data from the original `budgetTrackerDB` database and converts monetary values to integer cents.

## Deployment

Pushing to `main` runs tests, builds `dist`, and deploys the generated production application through GitHub Pages. Configure **Settings → Pages → Source** to use GitHub Actions once for the repository.
