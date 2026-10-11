// Build a distributable extension against a verified HTTPS backend.
// Usage: node --env-file=client/.env scripts/build-release.mjs https://your-api.onrender.com
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const api = new URL(process.argv[2]);
if (api.protocol !== 'https:' || api.username || api.password || api.pathname !== '/' || api.search || api.hash || /^(localhost|127\.|\[::1\])/.test(api.hostname)) throw new Error('Provide the HTTPS root URL of the hosted backend.');
const manifest = JSON.parse(readFileSync('client/public/manifest.json'));
if (!manifest.key) throw new Error('A stable public extension key is required.');
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) if (!process.env[name]) throw new Error(`Missing ${name}`);
execFileSync('npm', ['run', 'build'], { cwd: 'client', stdio: 'inherit', env: { ...process.env, VITE_API_URL: api.origin, VITE_AI_PROVIDER: 'gemini', VITE_AUTH_REDIRECT_URL: 'https://clickcoach-i8h0.onrender.com/verified.html' } });
mkdirSync('website/downloads', { recursive: true });
const archive = resolve('website/downloads/clickcoach.zip');
rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: 'client/dist' });
console.log('Created website/downloads/clickcoach.zip for ' + api.origin);
