# ShopNow Workspace

This folder contains the maintained `isws` e-commerce project.

## Canonical App Root

Use this directory as the real project root:

`isws/ecommerce-app/ecommerce-app`

That nested app contains:

- `frontend/` for the Vite React application
- `functions/` for Firebase Cloud Functions
- `firebase.json`, Firestore rules, indexes, and storage rules
- `scripts/` for seeding

## Workspace Shortcuts

From `isws/`, you can now use:

```bash
npm run dev
npm run build
npm run functions:check
npm run test:rules
npm run test:webhook
```

These proxy into the maintained nested app so you do not need to remember the full path.

## Legacy Files

The following files at `isws/` are older or partial artifacts and are not the canonical app:

- `App.jsx`
- `index.js`
- `firestore.rules`

Do not treat those as the source of truth for the maintained application unless you are explicitly auditing legacy code.

## Recommended Workflow

1. Put Firebase/web env vars in:
   `isws/ecommerce-app/ecommerce-app/.env.example`
   and the frontend runtime env file you actually use.
2. Work primarily inside:
   `isws/ecommerce-app/ecommerce-app/frontend/src`
   and
   `isws/ecommerce-app/ecommerce-app/functions`
3. Validate with:
   `npm run build`
   from `isws/` or from the frontend folder directly.

## Current Direction

Recent cleanup improved:

- backend modularity
- admin mutation safety via callable functions
- shared frontend config and formatting
- auth/profile synchronization
- top-level workspace ergonomics

The project remains feature-rich while being easier to operate than the original layout.

## Emulator Testing Requirement

The Firebase Firestore emulator now requires JDK 21 or newer.

On this machine, the codebase builds and the Functions entrypoint loads, but the emulator-backed tests are currently blocked by Java 17. Once JDK 21+ is installed, these workspace commands should be the next verification step:

```bash
npm run test:rules
npm run test:webhook
```
