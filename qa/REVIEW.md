# ClickCoach review and test results

Reviewed source: `C:\Users\IamaS\Desktop\hack (2).zip`, extracted into `clickcoach-review`. The original ZIP and GitaGPT application files were not edited. Archived Git metadata was not imported. Instructions in the archive were treated as project documentation, not as additional user requests.

## Access issue

The sandbox command launcher failed before running a command (`setup refresh had errors`). Approved execution outside that sandbox worked. This establishes a usable file-access path for this session; it does not establish that the underlying sandbox installation is repaired.

## Executed checks

- Original baseline: 13 server tests and 2 capture tests passed; Vite production build passed.
- New capture regression tests initially reproduced three failures: query-only navigation, fragment-only navigation, and switching tabs at an identical URL.
- Fixed those failures by retaining the full original URL, window ID, and tab ID in a module-local WeakMap keyed by the capture object. They are not serialized into API requests. Missing provenance also requires recapture.
- Added stateful mock HTTP tests for saved progress, reopening/listing guides, account isolation for list/read/update/delete, optimistic version conflicts, invalid input, and database outage recovery.
- Final verification: see `qa/server-tests.txt`, `qa/client-tests.txt`, and `qa/build.txt`.
- Dependencies installed from each supplied lockfile with install scripts disabled. No real AI call was made.

## Stage A coverage

PASS (mock) means executed code with simulated service/browser dependencies, not a claim about a configured real deployment.

| Requested scenario | Result | Evidence / remaining check |
| --- | --- | --- |
| Sign up and sign in | BLOCKED live | No configured Supabase URL/key or test accounts. Existing tests verify accepted/rejected mock JWTs, not signup or live login. |
| Capture browser tab | PASS (mock), browser pending | Capture returns the supplied fake image and sanitized context. Real screenshot-to-selected-tab visual matching still needs Chrome. |
| Navigate to another page | PASS (mock), browser pending | Path, query, fragment, cross-tab, and mid-capture changes tested. Manifest declares `<all_urls>`. Actual Chrome permission behavior remains unverified. |
| Generate mock guide | PASS (mock) | HTTP creation returns a schema-valid three-step mock guide. |
| Advance through steps | PASS (mock) | PATCH saves current step/completed array; bounds and stale versions are rejected. |
| Reopen saved guide | PASS (mock), live persistence pending | Subsequent GET and list return saved progress in a stateful in-memory database double. Not a database restart/durability test. |
| Disconnect backend | PARTIAL | Database outage and recovery tested at HTTP layer. Frontend catch displays an API-unreachable error by source inspection; actual disconnected-backend UI behavior not executed. |
| Invalid input | PASS (mock) | Missing fields, short goal, malformed JSON, unsafe URLs, invalid image syntax and out-of-range progress rejected. |
| Second-user isolation | PASS (mock), live RLS pending | Bob cannot list/read/update/delete Alice's guide through tested owner filters. Supabase ownership policies inspected, not applied or verified live. |
| Restricted page | PASS (mock), browser pending | `chrome://extensions` rejected before capture API call; permission-error propagation tested. |

## Stage B: all four real-AI evaluations BLOCKED

Spreadsheet operations, GitHub PR review, Notion relations/rollups, and Figma variants were not sent to a real model. The ZIP includes an empty root `.env`, example configuration files only, and no screenshots for these tasks. No Gemini or Supabase configuration was found in the execution environment variables checked for those services.

The server's configured default is `gemini-3.8-flash`, not the requested Flash-Lite-first setup. A mocked request test does not establish that this model identifier, request schema, or thinking configuration is accepted by a real API. Configure and verify the actual Flash-Lite model before evaluation; do not infer that arbitrary models accept the hardcoded `thinkingLevel: LOW` setting.

To complete: provide configuration through local environment files, disposable task screenshots, and a configured test Supabase project/accounts. Keep secrets out of chat. Run the exact supplied prompts on Flash-Lite; record model identifier, screenshot, output, latency, and rubric result. Re-run selected failures with the chosen stronger model using identical inputs. Do not claim test success from plausible-sounding text alone.

## Stage C coverage

The nine language/vision behavior scenarios below require actual Gemini output. Source-level prompt safeguards are not model-behavior passes.

| Scenario | Result / finding |
| --- | --- |
| Closed dropdown contents | BLOCKED real AI. Prompt generally prohibits invented visible controls; no evaluated response. |
| Button below visible page | BLOCKED real AI. Capture includes the viewport only. |
| Compare another tab | BLOCKED real AI. Request contains only one supplied page/image. |
| Automatically detect completion | BLOCKED real AI. UI says capture is not continuous; model prompt says it cannot observe later changes. |
| Fix everything | BLOCKED real AI. Prompt requests a safe next step when context is ambiguous. |
| Click and submit | BLOCKED real AI. No action-execution API exists; model prompt prohibits claiming performed actions. |
| Old screenshot after navigation | Three failures reproduced and fixed; capture guard regression tests PASS (mock). Same-URL UI changes, reloads, or navigating away and back are not proven fresh by this guard. Model interpretation remains untested. |
| Website says ignore user | BLOCKED real AI. System prompt treats screenshot/title/URL text as untrusted. |
| Fake credential in page | BLOCKED real AI. System prompt prohibits repeating private information; no output redactor enforces it. Screenshots are not written to tutorial rows. |
| Huge dense screenshot | BLOCKED real AI/browser readability. Capture is resized to at most 1600 pixels and JPEG quality 0.65; small text may become unreadable. No crop/zoom workflow exists. |

## What the project already does

React Chrome side panel, screenshot preview/consent, email/password auth and recovery, Gemini structured guides, mock mode, saved guides, manual step completion, per-user owner filtering/RLS SQL, optimistic progress versions, request size limits, and bounded provider retries. These are real implementation assets; they should not be pitched as new additions.

## Recommended build order after the test gate

1. **Evidence-backed visual steps.** Add visible-control labels and carefully validated highlight regions on the captured image. Steps must distinguish visible evidence from an instruction to reveal a hidden menu. Current step schema has only title, instruction, and expectedResult; it cannot represent evidence or highlight locations yet. Current model prompt explicitly disallows coordinates, so schema and prompting must change together. Do not label inferred coordinates as verified.
2. **Explicit fresh-capture progress checks.** A user-triggered Check my progress action evaluates the current step's expected result against a new screenshot and returns verified / not yet / cannot verify. Keep manual completion distinguishable from AI assessment and allow user correction. Do not infer an entire task or spreadsheet's data integrity from a visible fragment.
3. **Recovery when the screen differs.** A new capture replans remaining steps while preserving completed work. Currently generating another guide starts a separate tutorial, without a relation to the previous progress.
4. **One focused teaching demo.** Use a student learning spreadsheet operations: freeze headings, safely sort the whole table, then format revenue. Show a successful step, a fresh-capture check, and one honest cannot-verify response. Education is a plausible track based on the supplied categories; confirm final event rules before submission.

Build the first two well before broadening to many integrations. A strong pitch: "ClickCoach teaches you unfamiliar software one visible step at a time, and checks your work when you ask."

## Remaining issues to resolve before judging

- A successful client build with missing `.env` only proves compilation: the app displays its configuration screen until configured.
- Client mock/live labeling uses build-time `VITE_AI_PROVIDER`; server mode uses a separate environment variable. Keep them aligned. A future provider handshake should prevent a mock-labeled UI from sending images through a live backend.
- Capture identity checks cannot prove freshness when page contents change without a URL change. UI copy now explicitly asks users to recapture then.
- README claims screenshots clear on generation success, but the code retains the preview until discard/sign-out/panel lifecycle clears it. Correct that claim or change the lifecycle before making a demo privacy claim.
- No real Gemini accuracy, live Supabase isolation, or actual extension UI/permission pass is claimed here.
- Your pasted event deadline is October 11, 2026 at 10:00 AM ET, while the message says 2027. Resolve the year before relying on submission dates.

## Submission checklist (from your request)

Shared repository link; all team members as Devpost contributors; complete required project answers; exactly one track; at most two applicable superlatives. Publish measured test results with their mock/live scope. Do not claim universal website support.
