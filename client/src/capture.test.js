import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureTab, assertCurrentPage } from './capture.js';

function browser(t, url = 'https://example.com/page?view=one#first') {
  const originals = Object.fromEntries(['chrome', 'Image', 'document'].map(k => [k, globalThis[k]]));
  t.after(() => { for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  const state = { tab: { id: 7, windowId: 2, url, title: 'Test page' }, captures: 0 };
  globalThis.chrome = { tabs: {
    query: async () => [{ ...state.tab }],
    captureVisibleTab: async (windowId) => {
      assert.equal(windowId, 2); state.captures++;
      if (state.captureError) throw state.captureError;
      if (state.navigateDuringCapture) state.tab.url = 'https://example.com/other';
      return 'data:image/jpeg;base64,YQ==';
    },
  } };
  globalThis.Image = class {
    naturalWidth = 1920; naturalHeight = 1080;
    set src(value) { queueMicrotask(() => this.onload()); }
  };
  globalThis.document = { createElement: () => ({
    getContext: () => ({ drawImage() {} }),
    toDataURL: () => 'data:image/jpeg;base64,YQ==',
  }) };
  return state;
}

test('capture returns a preview and cleaned URL; same captured page can be reused', async t => {
  const state = browser(t);
  const context = await captureTab();
  assert.equal(context.screenshot, 'data:image/jpeg;base64,YQ==');
  assert.equal(context.url, 'https://example.com/page');
  await assertCurrentPage(context);
  await assertCurrentPage(context);
  assert.equal(state.captures, 1);
});

test('a changed path requires recapture', async t => {
  const state = browser(t);
  const context = await captureTab();
  state.tab.url = 'https://example.com/other';
  await assert.rejects(assertCurrentPage(context), /Recapture/i);
});

test('query-only navigation requires recapture', async t => {
  const state = browser(t);
  const context = await captureTab();
  state.tab.url = 'https://example.com/page?view=two#first';
  await assert.rejects(assertCurrentPage(context), /Recapture/i);
});

test('fragment-only navigation requires recapture', async t => {
  const state = browser(t);
  const context = await captureTab();
  state.tab.url = 'https://example.com/page?view=one#second';
  await assert.rejects(assertCurrentPage(context), /Recapture/i);
});

test('another tab at the same URL requires recapture', async t => {
  const state = browser(t);
  const context = await captureTab();
  state.tab.id = 8;
  await assert.rejects(assertCurrentPage(context), /Recapture/i);
});

test('restricted pages fail before calling capture API', async t => {
  const state = browser(t, 'chrome://extensions');
  await assert.rejects(captureTab(), /normal website/);
  assert.equal(state.captures, 0);
});

test('navigation during capture rejects the screenshot', async t => {
  const state = browser(t);
  state.navigateDuringCapture = true;
  await assert.rejects(captureTab(), /tab changed during capture/);
});

test('capture permission denial propagates without a result', async t => {
  const state = browser(t);
  state.captureError = new Error('Capture permission denied');
  await assert.rejects(captureTab(), /permission denied/);
});

test('capture identity stays local and query secrets are not serialized', async t => {
  browser(t, 'https://example.com/page?token=PRIVATE_TEST_VALUE#secret');
  const context = await captureTab();
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('PRIVATE_TEST_VALUE'), false);
  assert.equal(serialized.includes('tabId'), false);
  assert.deepEqual(Object.keys(context).sort(), ['screenshot', 'title', 'url']);
  await assertCurrentPage(context);
});

test('restored or foreign capture without local provenance requires recapture', async t => {
  browser(t);
  const context = await captureTab();
  await assert.rejects(assertCurrentPage(JSON.parse(JSON.stringify(context))), /Recapture/i);
});
