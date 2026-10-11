// Runs only in Chrome's isolated content-script world. Never executes model code.
export function pageCoach(action, target, expectedUrl) {
  const key = '__clickCoachOverlay';
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const url = new URL(location.href);
  url.search = ''; url.hash = ''; url.username = ''; url.password = '';
  if (action === 'clear') { window[key]?.(); return { ok: true }; }
  if (url.href !== expectedUrl) return { error: 'The page changed. Capture it again before showing a hint.' };
  function labelOf(el) {
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    return clean(el.getAttribute('aria-label') || labelled || [...(el.labels || [])].map(x => x.textContent).join(' ') || (el.matches('button,a,[role]') ? el.textContent : '') || el.getAttribute('title'));
  }
  const controls = [...document.querySelectorAll('button,a[href],input:not([type="hidden"]):not([type="password"]),select,textarea,[role="button"],[role="link"],[role="menuitem"],[role="tab"]')].map(el => {
    const r = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    const label = labelOf(el);
    const role = el.getAttribute('role') || ({ A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox', INPUT: 'input' }[el.tagName]);
    return { el, label, role, visible: !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[inert],[aria-hidden="true"]') && css.visibility !== 'hidden' && css.display !== 'none' && Number(css.opacity) !== 0 && r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
  }).filter(x => x.visible && x.label && x.label.length <= 120);
  if (action === 'scan') return { controls: controls.slice(0, 100).map(({ label, role }) => ({ label, role })) };
  window[key]?.();
  const matches = controls.filter(x => x.label === target?.label && x.role === target?.role);
  if (matches.length !== 1) return { error: matches.length ? 'More than one control matches. Ask your coach for a more specific step.' : 'That control is not visible here. Open the relevant menu, or send a fresh screenshot to update your guide.' };
  const { el } = matches[0];
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
  const root = host.attachShadow({ mode: 'closed' });
  const ring = document.createElement('div'), caption = document.createElement('div');
  ring.style.cssText = 'position:fixed;border:3px solid #287857;border-radius:9px;box-shadow:0 0 0 5px #c4e99099;box-sizing:border-box;pointer-events:none;';
  caption.style.cssText = 'position:fixed;background:#244d38;color:white;padding:8px 12px;border-radius:9px;font:600 13px system-ui;max-width:240px;box-sizing:border-box;pointer-events:none;';
  caption.textContent = '↑ ClickCoach · ' + target.label;
  root.append(ring, caption); document.documentElement.append(host);
  let frame, timer;
  const initialLocation = location.href;
  function clear() {
    cancelAnimationFrame(frame); clearTimeout(timer); host.remove();
    document.removeEventListener('keydown', escape, true);
    el.removeEventListener('click', clear, true);
    if (window[key] === clear) delete window[key];
  }
  function escape(e) { if (e.key === 'Escape') clear(); }
  function draw() {
    const r = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    if (document.hidden || labelOf(el) !== target.label || !el.isConnected || location.href !== initialLocation || el.disabled || css.visibility === 'hidden' || css.display === 'none' || !r.width || !r.height || r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) { clear(); return; }
    // Do not point through a covering dialog or a replaced control.
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && hit !== el && !el.contains(hit)) { clear(); return; }
    Object.assign(ring.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    const below = r.bottom + 48 < innerHeight;
    caption.textContent = `${below ? '↑' : '↓'} ClickCoach · ${target.label}`;
    Object.assign(caption.style, { left: `${Math.max(8, Math.min(r.left, innerWidth - 248))}px`, top: `${below ? r.bottom + 12 : Math.max(8, r.top - 48)}px` });
    frame = requestAnimationFrame(draw);
  }
  window[key] = clear;
  document.addEventListener('keydown', escape, true);
  el.addEventListener('click', clear, true);
  timer = setTimeout(clear, 30000);
  draw();
  return host.isConnected ? { ok: true } : { error: 'The control is covered or has changed. Update your screenshot.' };
}

let activeOverlay;
export async function clearHighlight() {
  const previous = activeOverlay; activeOverlay = null;
  if (previous) await chrome.scripting.executeScript({ target: previous, func: pageCoach, args: ['clear'] }).catch(() => {});
}
export async function inspectPage(url, target) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a normal website to use on-page coaching.');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageCoach, args: [target ? 'show' : 'scan', target || null, url] });
  const result = results[0];
  if (result?.result?.error) throw new Error(result.result.error);
  if (!result?.result) throw new Error('This page does not support on-page coaching.');
  if (target) activeOverlay = { tabId: tab.id, documentIds: [result.documentId] };
  return result.result;
}
