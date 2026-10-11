# ClickCoach — client / server rebuild

A React Chrome side-panel extension and a separate Express API. Supabase hosts authentication and PostgreSQL. The default mock guide generator lets the complete app run without an AI key or paid API request. No Docker, Redis, local PostgreSQL, or local Supabase instance is needed.

## Structure

- `client/src/`: React UI, Supabase sign-in, screenshot capture, API calls.
- `client/public/`: Chrome Manifest V3 and service worker.
- `server/index.js`: environment validation and API startup.
- `server/app.js`: authentication, routes, rate limits, validation, persistence.
- `server/mock-planner.js`: local demo guides with no AI API request.
- `server/gemini-planner.js`: Gemini screenshot analysis and structured guide generation.
- `server/planner.js`: legacy server-only OpenAI request, unused in mock mode.
- `server/schema.js`: input and generated-guide validation.
- `setup/supabase.sql`: SQL to paste into the Supabase dashboard. This file is a setup reference, not a local database.

## 1. Prerequisites

Use Node.js 22 or newer (`node -v`) and desktop Google Chrome. You need a Supabase project; its free plan is sufficient for development. Mock mode does not need an OpenAI or Gemini key. Do not paste secrets into chat or commit `.env` files.

This is a clean rebuild based on the screenshots and pasted API code. Existing project files were not available. It does not migrate old tutorials or replace your existing project automatically. Extract into a NEW folder first.

## 2. Configure Supabase

1. Open your Supabase project's SQL Editor.
2. Paste all of `setup/supabase.sql` and run it once. It creates `clickcoach_tutorials` with per-user RLS policies. If this table already exists, stop and inspect it rather than dropping it. The script is transactional.
3. Enable email/password authentication in Supabase Auth.
4. Obtain the project URL and **publishable key** (the legacy `anon` key also works). Both the client and server use this public key. Neither needs a service-role key.
5. Keep email confirmation enabled if desired. The extension shows a confirmation notice after sign-up; open the email confirmation link, then return to the extension and sign in. Set Supabase Auth's Site URL to a valid page you control for the confirmation-link redirect. Alternatively, create and confirm a development user through your Supabase dashboard.
6. In Supabase Auth's URL Configuration, add `chrome-extension://YOUR_EXTENSION_ID/index.html` to the allowed Redirect URLs. ClickCoach uses this page to finish password recovery after the user follows the emailed reset link.

The public key is expected to be in the client bundle. User access tokens plus database RLS protect rows. The server verifies every token with `auth.getUser(token)` and queries Supabase using that same user's JWT.

## 3. Build the extension

Open a terminal in the extracted `clickcoach` directory:

```bash
cd client
cp .env.example .env
```

Edit `client/.env`:

```dotenv
VITE_API_URL=http://127.0.0.1:3001
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_AI_PROVIDER=mock
```

Then:

```bash
npm ci
npm run build
```

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and choose **client/dist** (not client/src).
4. Copy the 32-character extension ID. Pin ClickCoach to the toolbar.

Rebuild with `npm run build` after changing client code or environment variables, then click Reload on the extension card and reopen the side panel. `npm run watch` can rebuild on code changes; you still need to reload the extension. There is no localhost React development tab in this extension workflow.

## 4. Start the API

In a second terminal, starting from the extracted `clickcoach` directory:

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```dotenv
PORT=3001
HOST=127.0.0.1
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
AI_PROVIDER=mock
EXTENSION_ID=PASTE_THE_ID_FROM_CHROME
```

Keep `AI_PROVIDER=mock` for the local demo. In this mode, the server creates a deterministic three-step guide and never contacts OpenAI, Gemini, or another AI provider.

To use Gemini after creating a free-tier API key in Google AI Studio, keep the key server-side and change the provider:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.8-flash
```

Restart the server after changing providers. Gemini mode sends the goal, page title, cleaned URL and the screenshot when selected to Google's Gemini API. Free-tier availability and quotas depend on the selected model and project; ClickCoach does not automatically switch to a paid model.

```bash
npm ci
npm run dev
```

Check the API at `http://127.0.0.1:3001/health`. It should show `{"ok":true}`. This checks API availability, not Supabase credentials.

## 5. Use it

1. Open a normal HTTP/HTTPS webpage and click the ClickCoach toolbar icon.
2. Click **Create an account** to open the signup screen, or sign in with an existing account. New passwords require at least eight characters, lowercase and uppercase letters, a number, and a special character.
3. Enter your goal.
4. Click **Capture current tab**. Review the screenshot before sending anything.
5. Leave **Include this screenshot in the mock request** checked to exercise the screenshot request path, or uncheck it to send only the goal, page title, and cleaned URL.
6. Click **Generate my guide**. A mock guide is generated locally and saved to Supabase.
7. Click step headings to switch steps, or **Mark done & continue** to save progress.
8. After navigating or switching tabs, click the toolbar icon on that tab, capture it, and generate a new guide for the current situation. Previously saved guides remain in Recent guides (latest 50).

The extension has HTTP/HTTPS host access so users can capture again after navigating during a guide. It calls the capture API only after the user clicks **Capture current tab**. Restricted pages such as chrome:// pages are deliberately rejected.

## What “screen sharing” means here

This version captures a screenshot of the visible browser tab when requested. It does not continuously stream your desktop, watch background tabs, or automatically execute actions. Updated visual guidance requires a new capture and generation. This makes the data being sent explicit and reviewable.

## Security and data handling

- Mock mode requires no AI secret and makes no paid AI request. Gemini mode keeps its key in `server/.env` and never exposes it to the extension.
- CORS allows the configured extension origin. CORS is not authentication; every API route also verifies the Supabase JWT.
- The extension manifest allows HTTPS requests to Supabase projects so authentication can run from the side panel.
- Supabase uses four ownership policies for select, insert, update and delete. The server adds an owner filter too.
- The user JWT is forwarded to Supabase; no service-role bypass is used.
- Screenshots remain in memory in the preview until discarded or generation succeeds. This app does not persist screenshots or raw page text.
- The screenshot is accepted by the local server so the full request flow is tested, but the mock planner does not inspect it or send it elsewhere.
- Stored data includes your prompt, generated guide, cleaned source URL, progress and timestamps. Avoid capturing sensitive pages.
- URL query strings and fragments are removed. URL paths and page titles can still contain private information.
- Session tokens use `chrome.storage.session`, restricted to trusted extension contexts. They survive side-panel closing, but clear on browser restart/extension reload. Sign in again afterward.
- ClickCoach cannot click, submit, or purchase anything. Rendered guide text is ordinary React text, not HTML.
- Input size limits, schema validation, timeouts, rate limits and optimistic progress version checks are included.
- Each mock generation is local. Viewing or advancing a guide also makes no AI request.

## Verification and deployment limits

Run `npm test` in `server` for tests covering authentication, owner scope/JWT propagation, malformed requests, step bounds, screenshot non-persistence, CORS, and mock-plan validation. These do not prove your live Supabase RLS configuration.

After configuration, validate with two distinct accounts: a guide from account A must not appear or be fetchable in account B. Verify create, refresh, progress, delete, confirmation email, and screenshot capture in Chrome. Test an outdated progress update from another panel: it should return 409 and require Refresh progress. Mock guides deliberately contain generic steps; accurate page-specific instructions come later when a provider such as Gemini is integrated.

This ships for local development. For public hosting, deploy the API behind HTTPS, set the correct host binding, update `VITE_API_URL` and `client/public/manifest.json` host permissions to your API origin, rebuild, set the production extension ID, configure proxy trust to match the real host, and use shared rate limiting if running multiple server processes. Current rate limits are in-memory per process and reset on restart. Do not expose this local configuration directly to the internet.

## Troubleshooting

- **Node errors:** use Node 22+. Install separately in both client and server.
- **Can't reach API:** keep the server running, check port/URL, and verify EXTENSION_ID exactly matches Chrome.
- **Capture permission error:** rebuild `client/dist`, reload ClickCoach in `chrome://extensions`, accept the requested site-access permission, and reopen the side panel. Screenshot capture uses the manifest's `<all_urls>` host permission; Chrome system pages such as `chrome://extensions` still cannot be captured.
- **Confirmation/sign-in error:** confirm the account and check Supabase email/password settings.
- **Password reset link opens the wrong page:** add the extension's exact `chrome-extension://.../index.html` URL to Supabase Auth's allowed Redirect URLs.
- **Database request failed:** run the SQL in the same project used by both .env files.
- **Guide generation failed in mock mode:** confirm both environment files use `mock`, then inspect the server terminal for the validation or database error.
- **Gemini quota exhausted:** switch both provider settings back to `mock`, rebuild the client, and restart the server, or wait for the free quota to reset.
- **Progress conflict:** click Refresh progress and try again.
- **Changes don't show:** rebuild client/dist, reload in chrome://extensions, and reopen the panel.

## Updated guide workspace and follow-up conversations

- The extension now has separate New guide, My guide, and History views, with one focused step and a step selector.
- In My guide, choose **Ask a question / update screenshot**. Send a question with an optional reviewed capture; the existing guide is updated using the original goal, current guide, completed steps, and saved conversation.
- Revisions reset step progress because the steps may have changed. Conversation text persists in the same guide; screenshot images do not. A guide supports up to 20 follow-up turns.
- Failed requests preserve the question and capture for retry. Concurrent updates return a conflict rather than overwriting newer changes; choose **Refresh progress** before retrying.

### Enable the update

1. For an existing database, run `setup/002-conversations.sql` in the Supabase SQL editor. This adds a conversation column without replacing guides. Fresh installations can use the updated `setup/supabase.sql`.
2. Restart the backend (`cd server` then `npm start`). Keep Gemini configured in the server environment.
3. Build the extension (`cd client` then `npm run build`) and reload it at `chrome://extensions`.
4. Test a new guide, two follow-up questions (one with a fresh screenshot), reopening from History, and creating another guide.

The standalone marketing page is in `website/index.html`; see `website/README.md` for preview and static hosting. It does not require login. No Chrome Web Store listing or public download URL is assumed.

## Show me, Read aloud, and Let me try

After rebuilding/reloading the extension and restarting the backend:

- **Show me** draws a ring and arrow on a uniquely matching, visible page control. It never clicks or moves the real mouse. Click the control, press Escape, choose Hide highlight, or wait 30 seconds to dismiss. Moving away from the guide also clears it.
- **Read aloud** reads the current instruction with Samantha (US) when installed, otherwise an available local English voice on Windows or other systems. There is no voice picker. Choose Slower, Normal, or Faster; replay or stop anytime. No Gemini request is made for speech. If no local voice exists, the UI explains that one is needed rather than using a remote voice.
- **Let me try first** hides the detailed instruction and expected result. **Give me a hint** reveals them and the coaching controls. Each step/revision starts with a fresh hint state. This mode does not automatically verify task completion.
- Captures now include up to 100 visible control labels and roles, never form input values. Gemini may return an exact target from that snapshot. The server discards invented or ambiguous targets, and the browser rechecks visibility and uniqueness before drawing.
- Existing guides remain readable; generate a new guide or send a fresh screenshot in the conversation to get targets. No additional SQL migration is needed for targets: they live in the existing steps JSON.
- This first version targets the top-level page DOM. Chrome system pages, embedded frames, closed shadow roots, and canvas-only controls may not support highlighting. Hidden/offscreen controls require opening the relevant area and capturing again; text guidance remains available.

### Practice without Gemini credits

Use existing mock mode on both client and server (`VITE_AI_PROVIDER=mock` / `AI_PROVIDER=mock`, then rebuild/restart). A captured button or link becomes a clearly labeled sample target for the first mock step. It is not an AI recommendation.

A fictional campus exercise is available at `qa/campus-demo.html`. To serve it, run `python3 -m http.server 4174 --bind 127.0.0.1` from the project root and open `http://localhost:4174/qa/campus-demo.html`. This is a local QA server, not a deployment server. The page also has standalone overlay-check buttons that use the actual targeting module.

Try: capture → generate → Show me → Read aloud → stop/replay → Let me try first → Give me a hint → complete a step → new guide → reopen history. Then reveal a new control, add a fresh screenshot to the conversation, and ask for the next step.

## Production deployment

The `render.yaml` blueprint deploys a free Node backend. Render supplies PORT; production listens on all interfaces and uses its reverse proxy. Store the Gemini key and Supabase configuration only in Render environment settings. `npm start` also works without a local .env file.

The GitHub Pages workflow publishes only `website/`. Enable Pages with **GitHub Actions** as the source in repository settings. Expected site URL: `https://clickcoach-i8h0.onrender.com/`.

In Supabase Authentication → URL Configuration:

- Set **Site URL** to `https://clickcoach-i8h0.onrender.com/verified.html` to replace the old localhost fallback.
- Add `https://clickcoach-i8h0.onrender.com/verified.html` to **Redirect URLs**.
- Preserve required existing redirects. For the extension's current password recovery flow, allow `chrome-extension://hemfkmakiclibfmmfcijmmmgbpjokenk/index.html` if supported by your auth configuration.
- Keep the signup email template's link as `{{ .ConfirmationURL }}` so Supabase verifies the email before redirecting. Previously sent emails can still contain the old redirect; use a new email after changing settings.

The verification page checks the returned signup session against Supabase before displaying success, handles failed/expired links, removes tokens from the URL, and does not store the session. Users then sign in inside the extension.

The manifest contains a **public** key to give every unpacked installation the same ID: `hemfkmakiclibfmmfcijmmmgbpjokenk`. This is not a secret API key. Existing developers may need to sign in again after reloading because their previous ID changes.

After the backend is live, run these from the repository root:

```sh
node scripts/check-hosted.mjs https://YOUR-API.onrender.com
node --env-file=client/.env scripts/build-release.mjs https://YOUR-API.onrender.com
```

The check script performs health, unauthenticated-access and CORS checks only; it never calls Gemini. The release script builds against the HTTPS backend and packages only `client/dist` into `website/downloads/clickcoach.zip`. Publish that file with the landing page and link it from the install section. Never package the server directory or .env files.
