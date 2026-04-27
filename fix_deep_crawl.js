// fix_deep_crawl.js — Enable DEEP_PATHS for contact page crawling

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

const OLD_DEEP = `const DEEP_PATHS = []; // disabled — homepage only for speed`;

// MAX_CRAWL=3: homepage (slot 0) + up to 2 deep paths
// Order matters — most likely to have email first
const NEW_DEEP = `const DEEP_PATHS = [
  '/contacts',     // EN — самый частый
  '/kontakty',     // RU транслитерация
  '/contact',      // EN short
  '/kontakt',      // RU/DE short
  '/about',        // sometimes has email
  '/o-nas',        // RU "о нас"
  '/o-kompanii',   // RU "о компании"
]; // MAX_CRAWL=3 → homepage + 2 deep paths per seed`;

for (const file of FILES) {
  const raw = fs.readFileSync(file, 'utf8');
  const wf = JSON.parse(raw);

  const node = wf.nodes.find(n => n.name === 'Select URL');
  if (!node) { console.error(`[${file}] Select URL not found`); continue; }

  const oldCode = node.parameters.jsCode;
  if (!oldCode.includes("const DEEP_PATHS = [];")) {
    console.warn(`[${file}] DEEP_PATHS pattern not found`);
    continue;
  }

  node.parameters.jsCode = oldCode.replace(OLD_DEEP, NEW_DEEP);

  if (node.parameters.jsCode === oldCode) {
    console.error(`[${file}] Replace failed`);
    continue;
  }

  // Validate JSON roundtrip
  const out = JSON.stringify(wf, null, 2);
  try { JSON.parse(out); } catch(e) { console.error(`[${file}] JSON invalid: ${e.message}`); continue; }

  fs.writeFileSync(file, out, 'utf8');
  console.log(`[${file}] Patched ✓`);
}

// Verify
const wf2 = JSON.parse(fs.readFileSync('Astra_Email_Extractor_v1_FINAL.json','utf8'));
const n = wf2.nodes.find(n => n.name === 'Select URL');
const mc = n.parameters.jsCode.match(/const MAX_CRAWL = (\d+)/);
const dp = n.parameters.jsCode.match(/const DEEP_PATHS = \[([\s\S]*?)\]/);
console.log('\nMAX_CRAWL:', mc ? mc[1] : 'NOT FOUND');
console.log('DEEP_PATHS entries:', dp ? dp[1].match(/'\/.+?'/g) : 'NOT FOUND');
