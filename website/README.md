# ClickCoach landing page

Hosted at https://clickcoach-i8h0.onrender.com via a Render static site publishing `website/` from this repository.

Local preview: `python3 -m http.server 4173 --directory website`.

The download at `downloads/clickcoach.zip` contains only the production extension build and uses https://clickcoach-api.onrender.com. Rebuild it with `node --env-file=client/.env scripts/build-release.mjs https://clickcoach-api.onrender.com` from the repository root after extension changes.

`verified.html` is the Supabase signup callback. Its `auth-config.js` contains only the public project URL and publishable key. No server secrets belong in this directory.
