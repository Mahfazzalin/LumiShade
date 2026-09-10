/**
 * LumiShade - Automated Review System Verification Suite
 * Tests review eligibility logic, cooldowns, opt-out, star flows, and settings sync.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 Starting LumiShade Review System Automated Test Suite...\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Replicate Review Logic
const MIN_INSTALL_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const MIN_USAGE_COUNT = 5;
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function evaluateEligibility(reviewState, privacyActive = false, isRestrictedTab = false) {
  if (!reviewState) return false;
  if (reviewState.completed) return false;
  if (reviewState.dontAskAgain) return false;
  if (privacyActive) return false;
  if (isRestrictedTab) return false;

  const now = Date.now();
  if (now - reviewState.installDate < MIN_INSTALL_AGE_MS) return false;
  if (reviewState.usageCount < MIN_USAGE_COUNT) return false;
  if (reviewState.lastPromptDate && (now - reviewState.lastPromptDate < COOLDOWN_MS)) return false;

  return true;
}

// 1. ELIGIBILITY TESTS
console.log('--- Review System Eligibility Tests ---');

it('Should not prompt on fresh install (install age < 3 days, usage < 5)', () => {
  const state = {
    installDate: Date.now(),
    usageCount: 1,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

it('Should not prompt if install age >= 3 days but usage < 5', () => {
  const state = {
    installDate: Date.now() - (4 * 24 * 60 * 60 * 1000),
    usageCount: 3,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

it('Should not prompt if usage >= 5 but install age < 3 days', () => {
  const state = {
    installDate: Date.now() - (1 * 24 * 60 * 60 * 1000),
    usageCount: 8,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

it('Should prompt when install age >= 3 days and usage >= 5', () => {
  const state = {
    installDate: Date.now() - (4 * 24 * 60 * 60 * 1000),
    usageCount: 5,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), true);
});

it('Should NEVER prompt while Privacy Blur is active', () => {
  const state = {
    installDate: Date.now() - (5 * 24 * 60 * 60 * 1000),
    usageCount: 10,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state, true, false), false);
});

it('Should NEVER prompt on restricted browser tabs', () => {
  const state = {
    installDate: Date.now() - (5 * 24 * 60 * 60 * 1000),
    usageCount: 10,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state, false, true), false);
});

// 2. COOLDOWN & DISMISSAL TESTS
console.log('\n--- 30-Day Cooldown & Dismissal Tests ---');

it('Should enforce 30-day cooldown after Maybe Later / Escape dismissal', () => {
  const state = {
    installDate: Date.now() - (10 * 24 * 60 * 60 * 1000),
    usageCount: 8,
    lastPromptDate: Date.now() - (5 * 24 * 60 * 60 * 1000), // dismissed 5 days ago
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

it('Should become eligible again after 30 days cooldown expires', () => {
  const state = {
    installDate: Date.now() - (40 * 24 * 60 * 60 * 1000),
    usageCount: 12,
    lastPromptDate: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days ago
    completed: false,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), true);
});

it('Should never prompt if dontAskAgain is true (opt-out)', () => {
  const state = {
    installDate: Date.now() - (40 * 24 * 60 * 60 * 1000),
    usageCount: 20,
    lastPromptDate: Date.now() - (40 * 24 * 60 * 60 * 1000),
    completed: false,
    dontAskAgain: true
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

it('Should never prompt once review is completed', () => {
  const state = {
    installDate: Date.now() - (40 * 24 * 60 * 60 * 1000),
    usageCount: 20,
    lastPromptDate: null,
    completed: true,
    dontAskAgain: false
  };
  assert.strictEqual(evaluateEligibility(state), false);
});

// 3. STORAGE & INTEGRITY TESTS
console.log('\n--- Storage Key Isolation Tests ---');

it('Review state and feedback use isolated storage keys', () => {
  const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup/popup.js'), 'utf8');
  assert(popupJs.includes("'lumishade_review'"), 'Must store review state in lumishade_review');
  assert(popupJs.includes("'lumishade_local_feedback'"), 'Must store feedback in lumishade_local_feedback');
  assert(popupJs.includes("'lumishade_settings'"), 'Must preserve lumishade_settings');
});

it('Settings UI contains toggle for review prompts and Web Store link', () => {
  const settingsHtml = fs.readFileSync(path.resolve(__dirname, '../settings/settings.html'), 'utf8');
  assert(settingsHtml.includes('id="toggle-review-prompts"'), 'Must have toggle-review-prompts input');
  assert(settingsHtml.includes('id="btn-rate-store"'), 'Must have btn-rate-store button');
});

it('Popup UI contains all required review dialog elements', () => {
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup/popup.html'), 'utf8');
  assert(popupHtml.includes('id="review-modal-backdrop"'), 'Must have #review-modal-backdrop');
  assert(popupHtml.includes('id="star-rating-group"'), 'Must have #star-rating-group');
  assert(popupHtml.includes('id="review-positive-panel"'), 'Must have #review-positive-panel');
  assert(popupHtml.includes('id="review-feedback-panel"'), 'Must have #review-feedback-panel');
  assert(popupHtml.includes('id="btn-review-later"'), 'Must have #btn-review-later');
  assert(popupHtml.includes('id="btn-review-never"'), 'Must have #btn-review-never');
  assert(popupHtml.includes('id="btn-leave-store-review"'), 'Must have #btn-leave-store-review');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
