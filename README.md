# Revive

Revive is a mobile-first Next.js app for a month-long youth group points
competition. Participants sign in with Google, log each available challenge
once per competition day, and follow a live leaderboard.

## Requirements

- Node.js 20 or newer
- A Supabase project
- A Google OAuth web client

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a Supabase project and copy its project URL and anon/public key into
   `.env.local`:

   ```sh
   cp .env.example .env.local
   ```

   Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The
   service-role key is not used by this app and must never be exposed to the
   browser.

3. Configure Google OAuth:

   - In Google Cloud Console, create an OAuth 2.0 Client ID with application
     type **Web application**.
   - Add your local and deployed app URLs as authorized JavaScript origins.
   - Add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an
     authorized redirect URI in Google Cloud.
   - In Supabase, open **Authentication → Providers → Google**, enable Google,
     and enter the Google client ID and client secret.
   - Disable the Email provider and any other providers in Supabase so Google
     is the only available sign-in method.
   - In Supabase **Authentication → URL Configuration**, set the site URL and
     add `http://localhost:3000/auth/callback` and your deployed
     `https://<your-domain>/auth/callback` as redirect URLs.

4. Apply the database migration to your hosted Supabase project. With the
   Supabase CLI installed, link this folder to the project and push the
   migrations:

   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push --remote
   ```

   The migration creates the schema, RLS policies, completion validation,
   leaderboard functions, and a Realtime broadcast channel that only sends a
   generic leaderboard-refresh notification. `supabase start` is only needed
   when you want to run the database locally; it is not required for a linked
   hosted project. The current Supabase CLI targets the local database by
   default, so keep `--remote` on this command even after linking the project.

   For local development, start the local Supabase services and apply the
   migrations to the local database with:

   ```sh
   supabase start
   supabase db reset
   ```

5. Add the first administrator in the Supabase SQL Editor (replace the address
   with the admin’s Google account). This is required before anyone can sign in:

   ```sql
   insert into public.allowed_emails (email, is_admin)
   values ('admin@example.com', true);
   ```

6. Run `supabase/seed.sql` in the Supabase SQL Editor. It inserts the poster’s
   Novice, Challenger, Elite, and Bonus challenges and the initial competition
   dates. The sample dates are November 2–December 1, 2026, with the Bonus
   challenges available November 2–8. Change those dates in the seed file before
   running it if your competition is scheduled for a different year.

7. Start the app:

   ```sh
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000). Add participant emails
   through the Admin page after signing in as the initial administrator.

## Tests and deployment

Run the points and daily-locking unit tests with:

```sh
npm test
```

Deploy to Vercel by importing the Git repository, adding
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment
variables, and deploying. Add the production callback URL to the Supabase Auth
redirect allowlist and the deployed origin to Google OAuth’s authorized
JavaScript origins. Apply any new migrations with `supabase db push --remote`.

## Data and access rules

- Google OAuth is the only sign-in provider used by the app.
- A database trigger creates a profile only for an allowlisted Google email.
  Users who are not allowlisted are sent to the Access not granted page.
- Completion inserts are restricted to the signed-in user and checked against
  the configured competition timezone, competition dates, and challenge
  availability. A unique database constraint prevents the same challenge from
  being recorded twice for one user on one competition day, including concurrent
  requests.
- Users can read the leaderboard and profiles, but completion rows are readable
  only by their owners. A public Realtime broadcast emits only a generic refresh
  notification after an insert; the leaderboard then reloads through its
  protected database function. The broadcast contains no participant or points
  data.
- Admin writes are protected by both application checks and RLS.
