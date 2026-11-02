# AnywhereWorks AI Hub

*Discover. Collaborate. Innovate.*

The internal home for AI projects across AnywhereWorks. Find a colleague, see their projects, open one, and get everything about it in one place.

## Two versions

- **Live site**: https://ramithavasu-sketch.github.io/ai-hub/. Shared Supabase database, sign-in with an Anywhere.co Google account. Every push to `main` deploys automatically.
- **Demo**: made-up sample data saved only in the viewer's browser. Used for the Claude artifact (`node scripts/build-artifact.mjs <out.html>`).

## Run it

```bash
npm run dev        # demo, sample data
npm run dev:live   # live database (needs .env.live)
```

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

- **Database**: Supabase project `ai-hub` (Mumbai). `supabase/migrations/` holds the tables, the read rules (row-level security) and one function per action. Each function checks permissions, so nobody can write to a table directly. `supabase/tests/rules-check.sql` checks the rules and rolls everything back.
- **Sign-in**: Google only, limited to Anywhere.co accounts (checked in the database when someone first signs in). New people start as **Viewers**; an Admin promotes them in the Admin Panel.
- **Google sign-in setup**: IT creates a Google OAuth client (Web application) with the redirect URI `https://whotlxcnewyhthdemqpy.supabase.co/auth/v1/callback`. The client ID and secret then go into Supabase → Authentication → Sign In / Providers → Google.
- **Still to come**: file uploads (resources are links for now).

## Code map

- `src/lib/types.ts`: data model (people, departments, projects, resources, updates, comments, activity)
- `src/lib/server.ts`: the demo rules layer. Every call takes the signed-in person and checks permissions.
- `src/lib/api.ts`: one set of actions for both versions (demo rules or live database functions)
- `src/components/Gate.tsx`, `Welcome.tsx`: live sign-in screen and first-time profile step
- `src/lib/seed.ts`: sample data
- `src/components/Shell.tsx`: sidebar, search, notifications, profile menu
- `src/components/hub.tsx`: shared cards, badges, Journey
- `src/pages/*`: one file per page
