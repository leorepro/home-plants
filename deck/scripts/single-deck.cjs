// Post-build step for the public site: send every path that isn't a slide
// (the root, /themes, /assets…) straight to the home-plants deck.
const fs = require('node:fs');

const base = process.env.OPEN_SLIDE_BASE || '/';
const deck = process.env.DECK_ID || 'home-plants';
const file = 'dist/index.html';
const html = fs.readFileSync(file, 'utf8');
const script = `<script>(function(){var b=${JSON.stringify(base)};var p=location.pathname;if(p.indexOf(b+"s/")!==0){history.replaceState(null,"",b+"s/${deck}"+location.search+location.hash);}})();</script>`;
if (!html.includes('<head>')) throw new Error('no <head> in dist/index.html');
fs.writeFileSync(file, html.replace('<head>', `<head>${script}`));
fs.copyFileSync(file, 'dist/404.html');
fs.writeFileSync('dist/.nojekyll', '');
console.log(`single-deck: redirecting non-slide paths to ${base}s/${deck}`);
