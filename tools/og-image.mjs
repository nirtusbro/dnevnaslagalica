// Renders tools/og-card.html to public/og-image.png (1200x630) with headless Chrome.
// Usage: npm run og   (set CHROME=/path/to/chrome if it is not found automatically)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const card = pathToFileURL(path.join(root, 'tools', 'og-card.html')).href;
const out = path.join(root, 'public', 'og-image.png');

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('Chrome not found; set CHROME=/path/to/chrome');
  process.exit(1);
}

execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--allow-file-access-from-files',
  '--virtual-time-budget=5000',
  '--window-size=1200,630',
  `--screenshot=${out}`,
  card,
], { stdio: 'inherit' });

console.log('wrote', path.relative(root, out));
