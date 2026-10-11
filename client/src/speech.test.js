import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNarrator } from './speech.js';
test('reads using a local voice, supports repeat and stop, and ignores late events', async () => {
  const states = [], calls = [];
  let stops = 0;
  const narrator = createNarrator({ stop() { stops++; }, async getVoices() { return [{ voiceName: 'Cloud', remote: true, lang: 'en-US' }, { voiceName: 'Local', remote: false, lang: 'en-US' }]; }, speak(text, opts) { calls.push({ text, opts }); } }, s => states.push(s));
  await narrator.speak('First', 0.8); await narrator.speak('Second');
  assert.equal(calls[0].opts.voiceName, 'Local'); assert.equal(calls[0].opts.rate, 0.8);
  calls[0].opts.onEvent({ type: 'end' }); assert.equal(states.at(-1), 'speaking');
  calls[1].opts.onEvent({ type: 'end' }); assert.equal(states.at(-1), 'idle');
  narrator.stop(); assert.equal(stops, 3);
});
test('does not fall back to a remote voice', async () => {
  const narrator = createNarrator({ stop() {}, getVoices: async () => [{ remote: true }], speak() { assert.fail('must not speak remotely'); } }, () => {});
  await assert.rejects(narrator.speak('hello'), /No local voice/);
});
test('cancel while voices load prevents delayed narration', async () => {
  let resolve;
  const narrator = createNarrator({ stop() {}, getVoices: () => new Promise(r => { resolve = r; }), speak() { assert.fail('cancelled'); } }, () => {});
  const pending = narrator.speak('hello'); narrator.stop(); resolve([{ remote: false }]); await pending;
});
