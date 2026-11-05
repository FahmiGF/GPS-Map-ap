const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const dupes = {};
for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
  dupes[m[1]] = (dupes[m[1]] || 0) + 1;
}
const duplicateIds = Object.entries(dupes).filter(([, c]) => c > 1);

const usedIds = new Set([...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
const missing = [...usedIds].filter(id => !htmlIds.has(id));

const classesUsed = new Set([...js.matchAll(/querySelectorAll\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
const classNames = [...classesUsed]
  .filter(sel => sel.startsWith('.'))
  .map(sel => sel.slice(1).split(/[ .:[>]/)[0]);
const missingClasses = classNames.filter(c => !html.includes(c));

console.log('HTML element IDs:', htmlIds.size);
console.log('IDs referenced by JS:', usedIds.size);
console.log('MISSING IDs:', missing.length ? missing : 'none');
console.log('DUPLICATE IDs:', duplicateIds.length ? duplicateIds : 'none');
console.log('querySelectorAll classes not present in HTML:', missingClasses.length ? missingClasses : 'none');

process.exitCode = missing.length || duplicateIds.length ? 1 : 0;
