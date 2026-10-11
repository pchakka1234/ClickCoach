import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { captureTab, assertCurrentPage } from "./capture";
import "./workspace.css";
import CoachTools from "./CoachTools";
import { clearHighlight, inspectPage } from "./page-coach";

export default function Workspace() {
  const [view, setView] = useState("new");
  const [guide, setGuide] = useState(null);
  const [history, setHistory] = useState([]);
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("");
  const [capture, setCapture] = useState(null);
  const [includeImage, setIncludeImage] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [chat, setChat] = useState(false);
  const [practice, setPractice] = useState(false);
  const [hintKey, setHintKey] = useState("");
  const lock = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    api("/api/tutorials").then(rows => { if (live.current) setHistory(current => [...current, ...rows.filter(row => !current.some(item => item.id === row.id))].slice(0, 50)); })
      .catch(e => { if (live.current) setError(e.message); });
    return () => { live.current = false; };
  }, []);
  async function run(label, fn) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError("");
    try { await fn(); } catch (e) { if (live.current) setError(e.message); }
    finally { lock.current = false; if (live.current) setBusy(""); }
  }
  function accept(row) {
    if (!live.current) return;
    setGuide(row);
    setHistory(rows => [row, ...rows.filter(x => x.id !== row.id)].slice(0, 50));
  }
  function navigate(next) { setView(next); setCapture(null); setError(""); }
  async function pageContext() {
    if (!capture) return undefined;
    await assertCurrentPage(capture);
    const { screenshot, ...page } = capture;
    return includeImage ? capture : page;
  }
  async function generate() {
    const context = await pageContext();
    if (!context) throw new Error("Capture your current tab first.");
    const row = await api("/api/tutorials", { method: "POST", body: JSON.stringify({ goal, context }) });
    accept(row); setMessage(""); setChat(false); navigate("guide");
  }
  async function continueGuide(e) {
    e.preventDefault();
    run("Updating your guide…", async () => {
      const context = await pageContext();
      const row = await api(`/api/tutorials/${guide.id}/continue`, {
        method: "POST", body: JSON.stringify({ message, version: guide.version, ...(context ? { context } : {}) }),
      });
      accept(row); setMessage(""); setCapture(null);
    });
  }
  async function progress(step, completed = guide.completed) {
    accept(await api(`/api/tutorials/${guide.id}`, { method: "PATCH", body: JSON.stringify({ currentStep: step, completed, version: guide.version }) }));
  }
  const preview = capture && <div className="preview">
    <img src={capture.screenshot} alt="Review this screenshot before sending" />
    <strong>{capture.title}</strong>
    <label className="check"><input type="checkbox" disabled={!!busy} checked={includeImage} onChange={e => setIncludeImage(e.target.checked)} />Include screenshot when sending</label>
    <button type="button" className="quiet" disabled={!!busy} onClick={() => setCapture(null)}>Remove capture</button>
  </div>;
  const captureButton = <button type="button" className="secondary" disabled={!!busy} onClick={() => run("Capturing…", async () => {
    await clearHighlight();
    const next = await captureTab();
    try { next.controls = (await inspectPage(next.url)).controls; } catch { /* Capture still works on pages that block scripts. */ }
    await assertCurrentPage(next);
    setCapture(next); setIncludeImage(true);
  })}>{capture ? "↻ Recapture tab" : "+ Add current screenshot"}</button>;
  const step = guide?.steps[guide.current_step];
  const stepKey = `${guide?.id}:${guide?.version}:${guide?.current_step}:${practice}`;
  const revealed = hintKey === stepKey;
  useEffect(() => { void clearHighlight(); }, [busy]);
  return <div className="workspace" aria-busy={!!busy}>
    <nav className="workspace-nav" aria-label="Guide navigation">
      <button disabled={!!busy} aria-current={view === "new" ? "page" : undefined} onClick={() => { setGoal(""); navigate("new"); }}>＋ New guide</button>
      {guide && <button disabled={!!busy} aria-current={view === "guide" ? "page" : undefined} onClick={() => navigate("guide")}>My guide</button>}
      <button disabled={!!busy} aria-current={view === "history" ? "page" : undefined} onClick={() => { navigate("history"); run("Loading history…", async () => setHistory(await api("/api/tutorials"))); }}>History</button>
    </nav>
    {error && <p role="alert" className="error">{error}</p>}
    {busy && <p className="notice" role="status">{busy}</p>}
    <div className="workspace-content">
      {view === "new" && <section>
        <span className="eyebrow">LET’S FIGURE IT OUT</span><h2>What would you like to do?</h2>
        <label htmlFor="goal">Your goal</label><textarea id="goal" disabled={!!busy} rows={3} value={goal} maxLength={2000} onChange={e => setGoal(e.target.value)} placeholder="Help me freeze the top row in Google Sheets." />
        {captureButton}{preview}
        <p className="privacy">Review before sending. Your goal, page title and URL, visible control labels, and optional screenshot go to the configured server and AI provider (except in mock mode). Guides and conversations are saved; screenshots are not stored by this app. Hide private information first.</p>
        <button disabled={!!busy || goal.trim().length < 3 || !capture} onClick={() => run("Building your guide…", generate)}>Generate my guide ↗</button>
      </section>}
      {view === "guide" && guide && <>
        {!chat && <section className="guide-card">
          <span className="eyebrow">ONE STEP AT A TIME</span><h2>{guide.title}</h2><p className="guide-summary">{guide.summary}</p>
          <progress max={guide.steps.length} value={guide.completed.length} /><small>{guide.completed.length} of {guide.steps.length} complete</small>
          <label htmlFor="step-select">Jump to a step</label><select id="step-select" disabled={!!busy} value={guide.current_step} onChange={e => run("Saving…", () => progress(Number(e.target.value)))}>{guide.steps.map((s, i) => <option key={i} value={i}>{guide.completed.includes(i) ? "✓ " : ""}{i + 1}. {s.title}</option>)}</select>
          <label className="check practice-toggle"><input type="checkbox" checked={practice} onChange={e => { setPractice(e.target.checked); setHintKey(""); }} />Let me try first</label>
          <div className="focused-step"><span className="step-number">{String(guide.current_step + 1).padStart(2, "0")}</span><h3>{step.title}</h3>{(!practice || revealed) && <><p>{step.instruction}</p><p className="expected"><b>You should see</b><br />{step.expectedResult}</p></>}</div>
          {!busy && <CoachTools key={stepKey} step={step} sourceUrl={guide.source_url} practice={practice} revealed={revealed} onReveal={() => setHintKey(stepKey)} />}
          <div className="step-actions"><button className="secondary" disabled={!!busy || guide.current_step === 0} onClick={() => run("Saving…", () => progress(guide.current_step - 1))}>← Previous</button><button disabled={!!busy} onClick={() => run("Saving…", () => progress(Math.min(guide.current_step + 1, guide.steps.length - 1), [...new Set([...guide.completed, guide.current_step])] ))}>{guide.completed.length === guide.steps.length ? "Completed ✓" : "Done & next →"}</button></div>
          {guide.completed.includes(guide.current_step) && <button className="quiet" disabled={!!busy} onClick={() => run("Saving…", () => progress(guide.current_step, guide.completed.filter(i => i !== guide.current_step)))}>Mark this step incomplete</button>}
          <button className="secondary" disabled={!!busy} aria-expanded={chat} onClick={() => setChat(!chat)}>{chat ? "Hide conversation" : "Ask a question / update screenshot"}</button>
          <div className="row"><button className="quiet" disabled={!!busy} onClick={() => run("Refreshing…", async () => accept(await api(`/api/tutorials/${guide.id}`)))}>Refresh progress</button><button className="quiet danger" disabled={!!busy} onClick={() => run("Deleting…", async () => { if (!window.confirm("Delete this guide and conversation?")) return; await api(`/api/tutorials/${guide.id}`, { method: "DELETE" }); setHistory(rows => rows.filter(x => x.id !== guide.id)); setGuide(null); setMessage(""); setGoal(""); navigate("new"); })}>Delete</button></div>
        </section>}
        {chat && <form className="conversation" onSubmit={continueGuide}>
          <button type="button" className="quiet" disabled={!!busy} onClick={() => setChat(false)}>← Back to guide</button><h2>Keep the conversation going</h2><small>Ask a question or explain what changed. Your coach will update the next steps in this guide. Updated steps start with fresh progress.</small>
          <div className="messages" aria-label="Conversation">{(guide.conversation || []).map((entry, i) => <div className={`message ${entry.role}`} key={i}><b>{entry.role === "user" ? "You" : "ClickCoach"}</b><p>{entry.text}</p>{entry.screenshot && <small>Screenshot included</small>}</div>)}</div>
          <label htmlFor="followup">Your message</label><textarea id="followup" rows={3} disabled={!!busy} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} placeholder="I don’t see that button. Here’s what my screen looks like now…" required />
          {captureButton}{preview}<small>A screenshot is optional. Only a new capture is sent; previous screenshots are not retained.</small>
          <button disabled={!!busy || !message.trim()}>Send & update guide →</button>
        </form>}
      </>}
      {view === "history" && <section><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Your guides</h2>{!history.length && <p>No saved guides yet. Start with a goal and a screenshot.</p>}{history.map(row => <button className="history" disabled={!!busy} key={row.id} onClick={() => run("Opening guide…", async () => { accept(await api(`/api/tutorials/${row.id}`)); setMessage(""); setChat(false); navigate("guide"); })}>{row.title}<small>{row.completed.length}/{row.steps.length} complete · {new Date(row.created_at).toLocaleDateString()}</small></button>)}</section>}
    </div>
  </div>;
}
