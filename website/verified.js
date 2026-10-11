// Remove credentials from the URL immediately; never save them in browser storage.
const hash = window.location.hash;
const search = window.location.search;
window.history.replaceState(null, '', window.location.pathname);
const { confirmationResult } = await import('./auth-result.mjs');
const { authConfig } = await import('./auth-config.js');
const result = await confirmationResult(hash, search, authConfig);
document.getElementById('mark').textContent = result.ok ? '✓' : '↗';
document.getElementById('title').textContent = result.title;
document.getElementById('message').textContent = result.message;
