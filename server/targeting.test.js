import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundTargets, generateSchema, planSchema } from './schema.js';
const target = { label: 'Feedback', role: 'button' };
const plan = { title: 'Find feedback', summary: 'Open your feedback', steps: [{ title: 'Open Feedback', instruction: 'Choose Feedback', expectedResult: 'Comments appear', target }] };
test('only unique observed controls can be persisted as targets', () => {
  assert.deepEqual(groundTargets(plan, [target]).steps[0].target, target);
  for (const controls of [[], [target, target], [{ ...target, role: 'link' }]]) assert.equal(groundTargets(plan, controls).steps[0].target, null);
});
test('supports older guides without targets and rejects executable target payloads', () => {
  const old = structuredClone(plan); delete old.steps[0].target; assert.ok(planSchema.safeParse(old).success);
  const bad = structuredClone(plan); bad.steps[0].target.selector = 'body'; assert.equal(planSchema.safeParse(bad).success, false);
});
test('caps control metadata and rejects input values', () => {
  const input = { goal: 'Find feedback', context: { url: 'https://example.com', title: 'Campus', controls: [target] } };
  assert.ok(generateSchema.safeParse(input).success);
  input.context.controls = Array(101).fill(target); assert.equal(generateSchema.safeParse(input).success, false);
  input.context.controls = [{ ...target, value: 'private' }]; assert.equal(generateSchema.safeParse(input).success, false);
});
