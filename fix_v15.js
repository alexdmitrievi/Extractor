/**
 * fix_v15.js — One-click full table processing
 *
 * Changes:
 * 1. Filter Rows: remove ROWS_LIMIT (process ALL rows without email in one run)
 * 2. Select URL: MAX_CRAWL=1 (homepage only — no /contacts, no deep crawl)
 *    Reason: most emails are on the homepage. Fetching 3 pages tripled execution time.
 * 3. Fetch Website: timeout 5s → 3s
 *
 * Result: 1000 rows × 1 URL × avg 1s = ~15-20 min per run (within n8n Cloud limits)
 */

const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

  // ── Fix 1: Filter Rows — remove ROWS_LIMIT ──────────────────────────────────
  const filterNode = wf.nodes.find(n => n.name === 'Filter Rows');
  if (filterNode) {
    filterNode.parameters.jsCode = `// Filter Rows v2 — skip rows that already have email, process ALL remaining
const items = $input.all();
const needsEmail = items.filter(item => !(item.json['E-mail'] || '').toString().trim());
console.log('[FilterRows] total=' + items.length + ' needs_email=' + needsEmail.length);
return needsEmail;`;
    console.log(`${file}: Filter Rows — removed ROWS_LIMIT`);
  }

  // ── Fix 2: Select URL — MAX_CRAWL=1, no DEEP_PATHS ─────────────────────────
  const selNode = wf.nodes.find(n => n.name === 'Select URL');
  if (selNode) {
    const key = selNode.parameters.jsCode ? 'jsCode' : 'code';
    let code = selNode.parameters[key];

    // MAX_CRAWL = 1
    code = code.replace(/const MAX_CRAWL\s*=\s*\d+;/, 'const MAX_CRAWL = 1;');

    // Empty DEEP_PATHS — don't crawl subpages at all
    code = code.replace(
      /const DEEP_PATHS\s*=\s*\[[\s\S]*?\];/,
      'const DEEP_PATHS = []; // disabled — homepage only for speed'
    );

    selNode.parameters[key] = code;
    console.log(`${file}: Select URL — MAX_CRAWL=1, DEEP_PATHS=[]`);
  }

  // ── Fix 3: Fetch Website timeout 3s ─────────────────────────────────────────
  const fetchNode = wf.nodes.find(n => n.name === 'Fetch Website');
  if (fetchNode?.parameters?.options) {
    fetchNode.parameters.options.timeout = 3000;
    console.log(`${file}: Fetch Website timeout → 3000ms`);
  }

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`${file}: done\n`);
});
