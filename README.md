# AnywhereWorks AI Hub

*Discover. Collaborate. Innovate.*

The internal home for AI projects across AnywhereWorks. Find a colleague, see their projects, open one, and get everything about it in one place.

## Two versions

- **Live**: a Google Apps Script web app, open only to Anywhere.co Google accounts. Data lives in a Google Sheet in the owner's Drive.
- **Demo**: made-up sample data saved only in the viewer's browser. Used for the Claude artifact (`node scripts/build-artifact.mjs <out.html>`).

## Run it

```bash
npm run dev                      # demo, sample data
npm run build:gas                # build the live version into gas/
npx @google/clasp@3 push --force # upload gas/ to Apps Script
npx @google/clasp@3 update-deployment <deployment id>   # publish it at the same link
```

The earlier Supabase version (`supabase/`, `.env.live`) is kept for reference only; the app no longer uses it.

`clasp` needs a `.clasp.json` (not committed) pointing at the Apps Script project with `"rootDir": "gas"`.

## What's inside

- **Home**: welcome hero, summary numbers, featured projects, latest updates, recently added, explore by team, and contributors.
- **Explore Projects**: search and filter by status, department, technology and keyword. Switch between grid and list views.
- **Our Contributors**: profile cards. Each profile groups that person's work into proposed, being developed, completed and collaborating on.
- **Project workspace**: overview (problem, solution, benefits), Project Journey (5 stages), resources grouped by type, progress updates, discussion, history, team with email links, and related projects.
- **Add / Edit Project**: only a name is needed to save a draft. Publishing needs the required fields. Visibility can be "All employees" or "Team only".
- **Departments, Resource Library, My Projects** (own / contribute / drafts), and an **Admin Panel** (access roles, deactivate, archive, feature, departments, stale-project nudges).

## Demo mode

- All data is **made-up sample data** saved **only in your browser** (localStorage). Nothing is shared with anyone yet.
- To try different roles, switch the person from the profile menu (top right). For example, Asha Raman is an Admin, Mira Okafor is a Contributor and Ella Brooks is a Viewer.
- To restore the original sample data, use **Profile menu → Reset sample data**.

## Live setup

- **Hosting and sign-in**: Apps Script web app that runs as its owner and is open to "Anyone within anywhere.co" (`gas/appsscript.json`). Google signs people in, so there is no sign-in screen. Anyone outside Anywhere.co is turned away.
- **Data**: on first use the script creates a Google Sheet, "AnywhereWorks AI Hub — data", with one tab per table. Cells are stored as plain text, and lists as JSON.
- **Rules**: every action goes through `api()` in `gas/Code.js`. It works out who is asking, runs the same rules as the demo (`gas/rules.js`, built from `src/lib/server.ts`), saves, and sends back only the projects that person may see. A lock stops two saves from clashing.
- **People**: whoever deployed the app is its first Admin. Everyone else joins as a **Viewer** on first visit and is asked for name, title and department. An Admin promotes people in the Admin Panel.
- **Still to come**: file uploads (resources are links for now).

## Code map

- `src/lib/types.ts`: data model (people, departments, projects, resources, updates, comments, activity)
- `src/lib/server.ts`: the demo rules layer. Every call takes the signed-in person and checks permissions.
- `src/lib/api.ts`: one set of actions for both versions (demo rules, or calls to Apps Script)
- `gas/Code.js`: the Apps Script server (Sheet storage, who is asking, rules). `gas/rules.js` and `gas/Index.html` are generated; don't edit them.
- `src/components/Gate.tsx`, `Welcome.tsx`: live loading / no-access screens and first-time profile step
- `src/lib/seed.ts`: sample data
- `src/components/Shell.tsx`: sidebar, search, notifications, profile menu
- `src/components/hub.tsx`: shared cards, badges, Journey
- `src/pages/*`: one file per page
