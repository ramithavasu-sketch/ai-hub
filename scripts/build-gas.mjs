// Builds the Apps Script version into gas/: rules.js (the shared rules) and Index.html
// (the whole app as one page). gas/Code.js and gas/appsscript.json are written by hand.
// Usage: node scripts/build-gas.mjs   then   npx @google/clasp push
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
run('npx vite build -c scripts/vite.gas-rules.config.js');
run('npx vite build --mode gas --outDir dist-gas');

const dist = path.join(root, 'dist-gas');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const asset = (href) => readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g)].map((m) => asset(m[1])).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => asset(m[1])).join('\n');
const fonts = [...html.matchAll(/<link [^>]*fonts\.(googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');
const themeScript = html.match(/<script>[\s\S]*?<\/script>/)[0];

// Apps Script adds the page title and viewport tag itself (see doGet in Code.js).
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<base target="_blank">
${fonts}
<style>${css}</style>
${themeScript}
</head>
<body>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
writeFileSync(path.join(root, 'gas/Index.html'), page);
console.log(`Wrote gas/Index.html (${(page.length / 1024).toFixed(0)} KB)`);
