import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase, configError } from "./supabase";
import { api } from "./api";
import { captureTab, assertCurrentPage } from "./capture";
import "./style.css";
import "./mock.css";
import "./auth.css";
const mockMode = (import.meta.env.VITE_AI_PROVIDER || "mock") === "mock";
const passwordRules = [
  { label: "8 or more characters", test: (value) => value.length >= 8 },
  { label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One number", test: (value) => /\d/.test(value) },
  {
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];
function App() {
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(false),
    [authMode, setAuthMode] = useState("signin"),
    [recoveryMode, setRecoveryMode] = useState(() =>
      window.location.hash.includes("type=recovery"),
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [goal, setGoal] = useState(""),
    [context, setContext] = useState(null),
    [includeImage, setIncludeImage] = useState(true);
  const [tutorial, setTutorial] = useState(null),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setReady(true);
        if (error) setError(error.message);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (live) {
        if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
        setSession(next);
        setReady(true);
        if (!next) {
          generation.current++;
          setTutorial(null);
          setHistory([]);
          setContext(null);
          setGoal("");
        }
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  async function run(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory() {
    const g = generation.current;
    const rows = await api("/api/tutorials");
    if (g === generation.current) setHistory(rows);
  }
  useEffect(() => {
    if (session?.user.id && !recoveryMode) run(loadHistory);
  }, [session?.user.id, recoveryMode]);
  const passwordValid = passwordRules.every((rule) => rule.test(password));
  function changeAuthMode(mode) {
    setAuthMode(mode);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }
  async function authenticate(signup) {
    if (signup && !passwordValid)
      throw new Error("Your password does not meet every requirement.");
    if (signup && password !== confirmPassword)
      throw new Error("The passwords do not match.");
    const { data, error } = await (signup
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password }));
    if (error) throw error;
    setPassword("");
    setConfirmPassword("");
    if (signup && !data.session) {
      setAuthMode("signin");
      setNotice(
        "Account created. Check your email to confirm it, then sign in.",
      );
    }
  }
  async function sendPasswordReset() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: chrome.runtime.getURL("index.html"),
    });
    if (error) throw error;
    setNotice(
      "If an account exists for that email, a password reset link is on its way.",
    );
  }
  async function updatePassword() {
    if (!passwordValid)
      throw new Error("Your password does not meet every requirement.");
    if (password !== confirmPassword)
      throw new Error("The passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    setRecoveryMode(false);
    setAuthMode("signin");
    setPassword("");
    setConfirmPassword("");
    setNotice("Password updated. Sign in with your new password.");
  }
  async function generate() {
    if (!context)
      throw new Error(
        "Capture the tab first so you can review what will be sent.",
      );
    await assertCurrentPage(context);
    const g = generation.current;
    const { screenshot, ...page } = context;
    const row = await api("/api/tutorials", {
      method: "POST",
      body: JSON.stringify({ goal, context: includeImage ? context : page }),
    });
    if (g !== generation.current) return;
    setTutorial(row);
    setHistory((prev) =>
      [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 50),
    );
  }
  async function saveProgress(step, completed) {
    const row = await api(`/api/tutorials/${tutorial.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        currentStep: step,
        completed,
        version: tutorial.version,
      }),
    });
    setTutorial(row);
    setHistory((prev) => prev.map((x) => (x.id === row.id ? row : x)));
  }
  async function refreshProgress() {
    const row = await api(`/api/tutorials/${tutorial.id}`);
    setTutorial(row);
    setHistory((prev) => prev.map((item) => (item.id === row.id ? row : item)));
    setNotice("Progress refreshed from the server.");
  }
  if (configError)
    return (
      <main>
        <h1>ClickCoach</h1>
        <p>
          Fill in client/.env using .env.example, then run npm run build and
          reload the extension.
        </p>
      </main>
    );
  if (!ready) return <main>Loading…</main>;
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">YOUR ON-SCREEN GUIDE</span>
          <h1>
            ClickCoach<span>↗</span>
          </h1>
        </div>
        {session && !recoveryMode && (
          <button
            className="quiet"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
              })
            }
          >
            Sign out
          </button>
        )}
      </header>
      <p className="intro">
        Tell us your goal. Get clear steps for the page in front of you.
      </p>
      {mockMode && (
        <p role="status" className="mock">
          Mock mode is active. Guide generation does not contact an AI provider.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {recoveryMode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(updatePassword);
          }}
        >
          <h2 className="auth-heading">Choose a new password</h2>
          <p className="auth-copy">
            Enter a secure password for your ClickCoach account.
          </p>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <ul className="password-rules" aria-label="Password requirements">
            {passwordRules.map((rule) => (
              <li key={rule.label} className={rule.test(password) ? "met" : ""}>
                {rule.label}
              </li>
            ))}
          </ul>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          {confirmPassword && password !== confirmPassword && (
            <small role="alert" className="password-match">
              Passwords do not match.
            </small>
          )}
          <button
            disabled={busy || !passwordValid || password !== confirmPassword}
          >
            {busy ? "Updating password…" : "Update password"}
          </button>
        </form>
      ) : !session ? (
        authMode === "signup" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => authenticate(true));
            }}
          >
            <h2 className="auth-heading">Create your account</h2>
            <p className="auth-copy">
              Use your email and choose a secure password.
            </p>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ul className="password-rules" aria-label="Password requirements">
              {passwordRules.map((rule) => (
                <li
                  key={rule.label}
                  className={rule.test(password) ? "met" : ""}
                >
                  {rule.label}
                </li>
              ))}
            </ul>
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            {confirmPassword && password !== confirmPassword && (
              <small role="alert" className="password-match">
                Passwords do not match.
              </small>
            )}
            <button
              disabled={
                busy || !email || !passwordValid || password !== confirmPassword
              }
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => changeAuthMode("signin")}
            >
              Back to sign in
            </button>
          </form>
        ) : authMode === "reset" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(sendPasswordReset);
            }}
          >
            <h2 className="auth-heading">Reset your password</h2>
            <p className="auth-copy">
              We’ll email you a secure link to choose a new password.
            </p>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button disabled={busy || !email}>
              {busy ? "Sending reset link…" : "Send reset link"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => changeAuthMode("signin")}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => authenticate(false));
            }}
          >
            <h2>Welcome back</h2>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => changeAuthMode("signup")}
            >
              Create an account
            </button>
            <button
              type="button"
              className="quiet auth-link"
              disabled={busy}
              onClick={() => changeAuthMode("reset")}
            >
              Forgot password?
            </button>
            <small>Sessions clear when you close Chrome.</small>
          </form>
        )
      ) : (
        <>
          <section>
            <h2>What would you like to do?</h2>
            <textarea
              value={goal}
              maxLength={2000}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="For example: Help me freeze the top row in Google Sheets."
              rows={4}
            />
            <button
              className="secondary"
              disabled={busy}
              onClick={() => run(async () => setContext(await captureTab()))}
            >
              {context ? "Recapture current tab" : "Capture current tab"}
            </button>
            <small>
              You can generate a new guide at any point. Recapture after
              changing the page, even when its URL stays the same.
            </small>
            <small>
              Only the visible tab area is captured when you click this button;
              this is not a continuous screen stream.
            </small>
            {context && (
              <div className="preview">
                <img
                  src={context.screenshot}
                  alt="Screenshot preview to review before sending"
                />
                <strong>{context.title}</strong>
                <small>{context.url}</small>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={(e) => setIncludeImage(e.target.checked)}
                  />
                  {mockMode
                    ? "Include this screenshot in the mock request"
                    : "Send this screenshot to the AI provider"}
                </label>
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => setContext(null)}
                >
                  Discard capture
                </button>
              </div>
            )}
            <p className="privacy">
              Generate sends your goal, page title and URL, plus the screenshot
              if checked, to the local server
              {mockMode
                ? " only. Mock mode does not contact an AI provider"
                : " and the configured AI provider"}
              . Tutorials and progress are saved in Supabase. Screenshots are
              not saved by this app. Hide private information before capture.
            </p>
            <button
              disabled={busy || goal.trim().length < 3 || !context}
              onClick={() => run(generate)}
            >
              {busy
                ? "Analyzing page…"
                : tutorial
                  ? "Generate a new guide"
                  : "Generate my guide"}
            </button>
          </section>
          {tutorial && (
            <section>
              <span className="eyebrow">YOUR GUIDE</span>
              <h2>{tutorial.title}</h2>
              <p>{tutorial.summary}</p>
              <small>Based on: {tutorial.source_url}</small>
              <progress
                max={tutorial.steps.length}
                value={tutorial.completed.length}
              />
              <small>
                {tutorial.completed.length} of {tutorial.steps.length} complete
              </small>
              <ol>
                {tutorial.steps.map((step, i) => (
                  <li
                    key={i}
                    className={i === tutorial.current_step ? "active" : ""}
                  >
                    <button
                      className="step"
                      disabled={busy}
                      onClick={() =>
                        run(() => saveProgress(i, tutorial.completed))
                      }
                    >
                      <span>
                        {tutorial.completed.includes(i) ? "✓" : i + 1}
                      </span>
                      {step.title}
                    </button>
                    {i === tutorial.current_step && (
                      <div className="instruction">
                        <p>{step.instruction}</p>
                        <p className="expected">
                          <b>You should see:</b> {step.expectedResult}
                        </p>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              saveProgress(
                                Math.min(i + 1, tutorial.steps.length - 1),
                                tutorial.completed.includes(i)
                                  ? tutorial.completed.filter((n) => n !== i)
                                  : [...tutorial.completed, i],
                              ),
                            )
                          }
                        >
                          {tutorial.completed.includes(i)
                            ? "Mark incomplete"
                            : "Mark done & continue"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {tutorial.completed.length === tutorial.steps.length && (
                <p className="notice">All steps complete!</p>
              )}
              <button
                className="quiet"
                disabled={busy}
                onClick={() => run(refreshProgress)}
              >
                Refresh progress
              </button>
              <button
                className="quiet danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!window.confirm("Delete this saved tutorial?")) return;
                    await api(`/api/tutorials/${tutorial.id}`, {
                      method: "DELETE",
                    });
                    setHistory((h) => h.filter((x) => x.id !== tutorial.id));
                    setTutorial(null);
                  })
                }
              >
                Delete guide
              </button>
            </section>
          )}
          <section>
            <div className="row">
              <h2>Recent guides</h2>
              <button
                className="quiet"
                disabled={busy}
                onClick={() => run(loadHistory)}
              >
                Refresh
              </button>
            </div>
            {!history.length && (
              <small>Your saved guides will appear here.</small>
            )}
            {history.map((row) => (
              <button
                key={row.id}
                className="history"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const fresh = await api(`/api/tutorials/${row.id}`);
                    setTutorial(fresh);
                    setGoal(fresh.goal);
                  })
                }
              >
                {row.title}
                <small>{new Date(row.created_at).toLocaleDateString()}</small>
              </button>
            ))}
          </section>
        </>
      )}
      <footer>Guidance only. You stay in control of every click.</footer>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
