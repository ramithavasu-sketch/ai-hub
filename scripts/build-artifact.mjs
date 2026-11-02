// Builds one self-contained HTML file for publishing as a Claude artifact.
// Usage: node scripts/build-artifact.mjs <output.html>
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Pass the output file path.');
const root = path.resolve(import.meta.dirname, '..');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

const dist = path.join(root, 'dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const asset = (href) => readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g)].map((m) => asset(m[1])).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => asset(m[1])).join('\n');
const fonts = [...html.matchAll(/<link [^>]*fonts\.(googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
const themeScript = html.match(/<script>[\s\S]*?<\/script>/)[0];

// The artifact skeleton supplies doctype, html, head and body.
const page = `<title>AnywhereWorks AI Hub</title>
${fonts}
<style>${css}</style>
${themeScript}
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
