MiliConnect — Frontend Prototype

Setup
1. cd ~/Desktop/coding/miliconnect-next
2. npm install
3. npm run dev

Scripts (useful):
- dev: starts Next.js dev server
- storybook: (optional) run Storybook if installed

Mock API (MSW)
- MSW is added as a dev dependency. The mocks are located in src/mocks.
- To enable MSW in development, import and start the worker in a client entry (e.g., in a custom _app or a client-side hook).

Storybook
- You can initialize Storybook with `npx sb init` and add stories for components/ to iterate UI.

Next steps I prepared
- MiliDDay component (components/MiliDDay.tsx) with localStorage persistence and extra features (next promotion/leave estimates).
- Basic tab pages: service, tips, market, share, mypage under src/app/(tabs).
- MSW handlers and browser worker scaffolded in src/mocks.

I can now:
- Wire MSW start in the client entrypoint and seed more mock endpoints.
- Initialize Storybook and add stories for MiliDDay and other components.
- Flesh out posts/market/feed UIs with mock CRUD using MSW.
Tell me which of these to prioritize next or I can continue wiring everything automatically.
