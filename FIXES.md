# ClickCoach fixes

## Install into your existing folder

Keep your existing client/.env and server/.env. This ZIP contains source code only; it excludes credentials, Git history, dependencies and generated builds.

Copy the client and server source files from this archive into your existing project, replacing matching files. Include the new server/gemini-request.js file. Keep the folder in the same location so Chrome's extension ID remains unchanged.

In client, run npm install and npm run build. Reload ClickCoach at chrome://extensions. In server, stop the old process and run npm install and npm run dev.

## What changed

- The reviewed capture remains available after generating a guide. You can edit the goal and generate a replacement guide while the current guide is unfinished. Old guides remain in history; the new guide has its own progress.
- Before reusing a capture, the client checks the current page URL. Recapture after navigation or changes to page content. Captures are snapshots, not a live stream.
- Gemini temporary HTTP failures (500, 502, 503, 504) retry up to three times, with one shared 60-second deadline. Each retry preserves the exact image payload. Persistent failures show a clear error and preserve the capture for another attempt.
- Provider transport and retry handling live in server/gemini-request.js. Structured tutorial generation remains in server/gemini-planner.js.
- Client and server JavaScript, JSX, CSS, HTML and JSON were formatted for readability. Existing authentication, database and tutorial schemas were retained.

## Debugging

The server logs HTTP status, provider status, attempt number and whether a retry follows. It does not log API keys, prompts or images. A 503 is an upstream service failure; retries improve recovery but cannot guarantee provider availability.

No live Gemini request was tested with your private credentials. Run a screenshot-enabled guide after installation to confirm behavior with your account.

## Verification

13 server tests and 2 capture tests passed. Client production build passed. Retry tests cover recovery after 503, persistent failures, preserving image data, and not retrying invalid requests.
