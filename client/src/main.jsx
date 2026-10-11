import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase, configError } from "./supabase";
import "./style.css";
import "./mock.css";
import "./auth.css";
import Workspace from "./Workspace";
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
      ? supabase.auth.signUp({ email, password, options: { emailRedirectTo: import.meta.env.VITE_AUTH_REDIRECT_URL || "https://clickcoach-i8h0.onrender.com/verified.html" } })
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
        <Workspace key={session.user.id} />
      )}
      <footer>Guidance only. You stay in control of every click.</footer>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
