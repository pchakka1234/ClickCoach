import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageCoach, inspectPage, clearHighlight } from './page-coach.js';
function fixture(t, elements = []) {
  const globals = ['window','document','location','getComputedStyle','innerWidth','innerHeight'];
  const old = Object.fromEntries(globals.map(k => [k, globalThis[k]]));
  t.after(() => { for (const k of globals) { if (old[k] === undefined) delete globalThis[k]; else globalThis[k] = old[k]; } });
  Object.assign(globalThis, { window: {}, location: { href: 'https://example.com/page?private=value' }, innerWidth: 1000, innerHeight: 800, getComputedStyle: el => ({ visibility: el.hidden ? 'hidden' : 'visible', display: 'block', opacity: '1' }), document: { querySelectorAll: () => elements, getElementById: () => null } });
}
function button(label, overrides = {}) { return { tagName: 'BUTTON', textContent: label, getAttribute: () => null, getBoundingClientRect: () => ({ top: 10, left: 10, right: 110, bottom: 50, width: 100, height: 40 }), closest: () => null, matches: () => true, ...overrides }; }
test('scan sends labels and roles only, excluding hidden and disabled controls', t => {
  fixture(t, [button('  Assignments  '), button('hidden', { hidden: true }), button('disabled', { disabled: true }), button('Email', { tagName: 'INPUT', value: 'secret@example.com', matches: () => false, labels: [{ textContent: 'Email' }] })]);
  const result = pageCoach('scan', null, 'https://example.com/page');
  assert.deepEqual(result.controls, [{ label: 'Assignments', role: 'button' }, { label: 'Email', role: 'input' }]);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('duplicate and missing targets refuse to draw', t => {
  fixture(t, [button('Assignments'), button('Assignments')]);
  assert.match(pageCoach('show', { label: 'Assignments', role: 'button' }, 'https://example.com/page').error, /More than one/);
  assert.match(pageCoach('show', { label: 'Invented', role: 'button' }, 'https://example.com/page').error, /not visible/);
});
test('navigation rejects stale page hints and clear tears down existing overlay', t => {
  fixture(t);
  assert.match(pageCoach('scan', null, 'https://example.com/other').error, /page changed/);
  let removed = false; window.__clickCoachOverlay = () => { removed = true; };
  pageCoach('clear'); assert.equal(removed, true);
});
test('capture candidates are bounded to 100', t => { fixture(t, Array.from({ length: 150 }, (_, i) => button('Control ' + i))); assert.equal(pageCoach('scan', null, 'https://example.com/page').controls.length, 100); });
test('extension wrapper rejects restricted tabs and clears the exact injected document', async t => {
  const old = globalThis.chrome; t.after(() => { globalThis.chrome = old; });
  const calls = []; let tab = { id: 3, url: 'chrome://settings' };
  globalThis.chrome = { tabs: { query: async () => [tab] }, scripting: { executeScript: async options => { calls.push(options); return [{ documentId: 'document-a', result: { ok: true } }]; } } };
  await assert.rejects(inspectPage('https://example.com'), /normal website/);
  tab = { id: 3, url: 'https://example.com' };
  await inspectPage(tab.url, { label: 'Assignments', role: 'button' }); await clearHighlight(); await clearHighlight();
  assert.equal(calls.length, 2); assert.deepEqual(calls[1].target, { tabId: 3, documentIds: ['document-a'] });
});
