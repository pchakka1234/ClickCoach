# ClickCoach landing page

A standalone, responsive static site. No login, backend, or build step.

Preview from the project root:

```sh
python3 -m http.server 4173 --directory website
```

Open http://localhost:4173. For public hosting, deploy this `website` directory to any static host. It is independent of the extension build. Google Fonts are optional; system fonts are the fallback.

Installation instructions accurately describe the current unpacked hackathon build. Once you have a public release ZIP or Chrome Web Store listing, link it in the installation section. Do not distribute server environment files, Gemini keys, or Supabase service-role keys.
