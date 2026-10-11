# ClickCoach

**Learn unfamiliar websites by doing—with guidance beside your work.**

ClickCoach is a Gemini-powered Chrome extension that helps students turn a goal into a step-by-step guide. Capture the current tab, ask for help, and follow instructions in the browser side panel. When you get stuck, ask a follow-up question or share a fresh screenshot without starting over.

**[Visit the website](https://clickcoach-i8h0.onrender.com) · [Download the extension](https://clickcoach-i8h0.onrender.com/downloads/clickcoach.zip)**

## Try it

The hosted version requires no local server, build commands, or personal Gemini API key.

1. Download the extension ZIP above and extract it into a folder you will keep on your computer.
2. Open `chrome://extensions` in desktop Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Pin ClickCoach using Chrome’s extensions menu. Disable any older ClickCoach installation to avoid confusion.
5. Open a normal website, open ClickCoach, and create an account. Follow the confirmation email, then return to the extension and sign in.
6. Describe your goal, capture the page, review the screenshot, and select **Generate my guide**.

This is an unpacked hackathon release, not a Chrome Web Store listing. Keep the extracted folder in place after installation.

The free Render backend can sleep after inactivity. The first request may take about a minute while it wakes. Before a demo, open the [health endpoint](https://clickcoach-api.onrender.com/health) and wait for `{"ok":true}`. No redeployment is needed to wake it.

## What you can do

- **Follow a focused guide:** view one step at a time and save progress.
- **Show me:** draw a ring and arrow around a uniquely matching, visible page control. ClickCoach never clicks for you or moves your real mouse.
- **Read aloud:** hear the current instruction using a local speech-synthesis voice, with speed, replay, and stop controls. Samantha US is preferred when available; other systems use an available local English voice.
- **Let me try first:** attempt a step before revealing its instruction and expected result.
- **Continue the conversation:** ask a question, correct the goal, or add a reviewed screenshot to update the same guide.
- **Return later:** reopen saved guides and conversations from History.

Example goal: “Help me create a weekly study planner in this spreadsheet and freeze its header.”

Example follow-up: “I don’t see that option. Here’s my current screen—what should I do next?”

## How it works

1. The extension captures the visible tab only when requested and collects up to 100 visible control labels and roles.
2. The Express backend verifies the user’s Supabase session and sends the goal, page context, and optional screenshot to Gemini.
3. Gemini returns a structured guide. The backend validates its format and checks highlight targets against the supplied controls.
4. The extension rechecks each target’s visibility and uniqueness before drawing a highlight.
5. Supabase stores the guide, conversation, and progress under the user’s account.

Narration, highlighting, and advancing through an existing guide do not make additional Gemini requests. Generating or revising a guide does.

## Built with

- **Extension:** JavaScript, React, Vite, Chrome Manifest V3, browser speech synthesis
- **Backend:** Node.js, Express, Zod, Gemini API
- **Authentication and database:** Supabase Auth and PostgreSQL with row-level security
- **Hosting:** Render web service and static site

## Privacy and limitations

- Screenshots are captured on demand, not streamed continuously. Users can review a capture before sending it to Gemini.
- The app does not persist screenshot images in its database. Stored data includes prompts, conversation text, guides, cleaned source URLs, and progress.
- URL query strings and fragments are removed; titles, URL paths, and screenshots may still contain sensitive information. Review captures before sending them.
- The Gemini key stays on the backend. The extension contains only public Supabase configuration. API routes verify the user’s session, and database policies scope access to the owner.
- Highlighting supports uniquely identified controls in the top-level page. Embedded frames, closed shadow roots, canvas controls, hidden controls, and restricted Chrome pages may not support it.
- Gemini guidance can be incorrect. ClickCoach does not automatically verify that a step was completed or perform actions on the user’s behalf.
- Local narration requires an installed English voice. Voice quality varies by operating system.
- The free deployment is intended for a hackathon demonstration. Provider quotas and the backend’s per-process rate limits still apply; large-scale load capacity has not been established.

## Local development

Use Node.js 22+ and desktop Chrome. Run commands from the repository root.

```sh
npm ci --prefix client
npm ci --prefix server
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Create your own Supabase project and configure email/password authentication. For a fresh database, inspect and run `setup/supabase.sql` in the Supabase SQL editor. For an existing ClickCoach database, inspect `setup/002-conversations.sql` to add conversation support without replacing guides.

Set these values in `client/.env`:

```dotenv
VITE_API_URL=http://127.0.0.1:3001
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
VITE_AI_PROVIDER=gemini
VITE_AUTH_REDIRECT_URL=https://YOUR_VERIFICATION_SITE/verified.html
```

Set these values in `server/.env`:

```dotenv
PORT=3001
HOST=127.0.0.1
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.8-flash
EXTENSION_ID=hemfkmakiclibfmmfcijmmmgbpjokenk
```

Use a Gemini model available to your project that supports the request configuration in `server/gemini-planner.js`. Never commit actual `.env` files or API secrets. A Supabase service-role key is not required.

For your own Supabase project, host the verification files from `website/` and update `website/auth-config.js` with your public project configuration. Set Supabase Auth’s Site URL and allowed Redirect URL to that verification page. Keep the default confirmation link (`{{ .ConfirmationURL }}`) in signup emails. The extension’s password-recovery flow also needs its `chrome-extension://<extension-id>/index.html` redirect allowed where supported.

Build the extension and start the backend:

```sh
npm run build --prefix client
npm run dev --prefix server
```

Load `client/dist` through Chrome’s **Load unpacked** button. After client changes, rebuild and reload the extension. After environment changes, restart the backend or rebuild the client as appropriate.

The manifest’s public `key` keeps the unpacked extension ID consistent across computers. It is not an API secret.

An optional development-only mock provider is available by setting both `VITE_AI_PROVIDER` and `AI_PROVIDER` to `mock`, then rebuilding/restarting. It produces sample guides without calling Gemini; the hosted release uses Gemini.

## Tests

```sh
npm test --prefix server
node --test client/src/*.test.js
npm run build --prefix client
node scripts/check-hosted.mjs https://clickcoach-api.onrender.com
```

At submission preparation, all **51 automated tests** passed: 30 server tests and 21 client tests. Coverage includes authentication, ownership filters, continuation conflicts and retries, capture handling, highlight targeting, and local narration. The production build and hosted health/authentication/CORS checks also passed.

Two small live Gemini planner checks passed, including a mid-guide goal correction and a valid highlight target. These are smoke tests, not proof of accuracy on every website or a full hosted end-to-end test. The automated suites use stubbed providers and do not spend Gemini credits; the hosted check script does not call generation endpoints.

For manual verification, test signup, email confirmation, generation, “Show me,” narration, a follow-up with a fresh screenshot, and reopening History. Use two accounts to check that saved guides stay separate.

## Deployment and release updates

The backend runs on Render using `npm ci --prefix server` to build and `npm start --prefix server` to start. Configure secrets in Render’s environment settings. `render.yaml` provides the backend blueprint. Production uses `HOST=0.0.0.0`, `NODE_ENV=production`, and `TRUST_PROXY=1` for the Render reverse proxy.

The landing page is a separate Render static site publishing `website/`. Its signup verification page checks the returned signup session with Supabase before displaying success and clears credentials from the URL.

After extension changes, rebuild the distributable with your configured client environment:

```sh
node --env-file=client/.env scripts/build-release.mjs https://clickcoach-api.onrender.com
```

This packages only the production extension into `website/downloads/clickcoach.zip`. Commit the updated ZIP and source, push, and confirm the relevant Render deployments complete. Use **Manual Deploy → Deploy latest commit** if a deployment does not start automatically. Existing unpacked installations must load the updated files and reload the extension.

## Repository layout

| Path | Purpose |
| --- | --- |
| `client/` | Extension UI, capture, highlighting, narration, and manifest |
| `server/` | API, Gemini planner, validation, and server tests |
| `setup/` | Supabase schema and conversation migration |
| `website/` | Landing page, verification page, and production ZIP |
| `scripts/` | Release packaging and hosted checks |
| `qa/` | Local manual-test fixtures |
| `render.yaml` | Backend deployment blueprint |
