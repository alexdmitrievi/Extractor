// fix_v18.js — Expand DEEP_PATHS + MAX_CRAWL=5 for deeper email coverage

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const file of FILES) {
  const raw = fs.readFileSync(file, 'utf8');
  const wf = JSON.parse(raw);

  const node = wf.nodes.find(n => n.name === 'Select URL');
  if (!node) { console.error(`[${file}] Select URL not found`); continue; }

  const oldCode = node.parameters.jsCode;

  // Replace MAX_CRAWL
  let newCode = oldCode.replace(/const MAX_CRAWL = \d+;/, 'const MAX_CRAWL = 5;');

  // Replace DEEP_PATHS block
  const deepPathsPattern = /const DEEP_PATHS = \[[\s\S]*?\];[^\n]*/;
  const newDeepPaths = `const DEEP_PATHS = [
  // Контакты — самые частые пути (en + ru транслит)
  '/contacts',        // наиболее популярный EN
  '/kontakty',        // RU транслит "контакты"
  '/contact',         // EN short
  '/kontakt',         // RU/DE short
  '/contacts.html',   // статические сайты
  '/kontakty.html',
  '/contact.html',
  '/contact-us',
  '/svyaz-s-nami',    // "связь с нами"
  '/svyaz',           // "связь"
  '/napisat',         // "написать"
  '/feedback',        // обратная связь
  '/obratnaya-svyaz', // "обратная связь"
  '/obratnasvyaz',
  // О компании — часто содержит email
  '/about',
  '/o-nas',           // "о нас"
  '/o-kompanii',      // "о компании"
  '/about.html',
  '/about-us',
  '/company',
  '/ru/contacts',     // мультиязычные сайты
]; // MAX_CRAWL=5 → homepage + до 4 глубоких страниц`;

  if (!deepPathsPattern.test(newCode)) {
    console.error(`[${file}] DEEP_PATHS pattern not found`);
    continue;
  }

  newCode = newCode.replace(deepPathsPattern, newDeepPaths);

  if (newCode === oldCode) {
    console.error(`[${file}] No changes made`);
    continue;
  }

  node.parameters.jsCode = newCode;

  const out = JSON.stringify(wf, null, 2);
  try { JSON.parse(out); } catch(e) { console.error(`[${file}] JSON invalid: ${e.message}`); continue; }

  fs.writeFileSync(file, out, 'utf8');
  console.log(`[${file}] Patched ✓`);
}

// Verify
const wf2 = JSON.parse(fs.readFileSync('Astra_Email_Extractor_v1_FINAL.json', 'utf8'));
const n = wf2.nodes.find(n => n.name === 'Select URL');
const mc = n.parameters.jsCode.match(/const MAX_CRAWL = (\d+)/);
const dp = n.parameters.jsCode.match(/const DEEP_PATHS = \[([\s\S]*?)\];/);
const paths = dp ? dp[1].match(/'\/[^']+'/g) : [];
console.log('\nMAX_CRAWL:', mc ? mc[1] : 'NOT FOUND');
console.log('DEEP_PATHS count:', paths ? paths.length : 0);
console.log('Paths:', paths ? paths.join(', ') : 'NONE');
console.log('\nLogic: homepage(1) + DEEP_PATHS tried in order until MAX_CRAWL(5) reached');
console.log('= 1 homepage + 4 contact/about page attempts per company');
