import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clearHighlight, inspectPage } from './page-coach';
import { createNarrator } from './speech';

export default function CoachTools({ step, sourceUrl, practice, revealed, onReveal }) {
  const [speech, setSpeech] = useState('idle');
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const mounted = useRef(true);
  const narrator = useMemo(() => createNarrator(globalThis.chrome?.tts, state => { if (mounted.current) setSpeech(state); }), []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; narrator.stop(); void clearHighlight(); };
  }, [narrator]);
  async function show() {
    setLocating(true); setStatus('');
    try {
      await clearHighlight();
      await inspectPage(sourceUrl, step.target);
      if (!mounted.current) { await clearHighlight(); return; }
      setStatus('Highlighted for 30 seconds. Click it yourself, or press Escape to hide.');
    } catch (e) { if (mounted.current) setStatus(e.message); }
    finally { if (mounted.current) setLocating(false); }
  }
  async function read() {
    setStatus('');
    try { await narrator.speak(`${step.title}. ${step.instruction}. You should see: ${step.expectedResult}`, rate); }
    catch (e) { if (mounted.current) setStatus(e.message); }
  }
  return <div className="coach-tools">
    {practice && !revealed ? <><p className="practice-prompt">Try this step on your own. Reveal a hint whenever you need one.</p><button className="secondary" onClick={onReveal}>Give me a hint</button></> : <>
      <div className="step-actions"><button className="secondary" disabled={locating || !step.target} onClick={show}>{locating ? 'Finding control…' : '◎ Show me'}</button><button className="secondary" onClick={() => { if (speech === 'speaking') narrator.stop(); else void read(); }}>{speech === 'speaking' ? '■ Stop reading' : '▶ Read aloud'}</button></div>
      {!step.target && <small>For an on-page hint, send a fresh screenshot in the conversation and ask where to click. Older guides may not include targets.</small>}
      <label className="voice-speed">Reading speed <select value={rate} onChange={e => { narrator.stop(); setRate(Number(e.target.value)); }}><option value="0.8">Slower</option><option value="1">Normal</option><option value="1.2">Faster</option></select></label>
      <button className="quiet" onClick={() => { void clearHighlight(); setStatus(''); }}>Hide highlight</button>
    </>}
    {(status || speech === 'error') && <p className="coach-status" role="status">{speech === 'error' ? 'The local voice could not play. Try Read aloud again or check your system voice settings.' : status}</p>}
  </div>;
}
