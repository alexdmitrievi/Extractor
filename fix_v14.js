/**
 * fix_v14.js
 *
 * ROOT CAUSE: n8n Cloud execution times out (iteration ~41) because:
 * 1. Workflow processes ALL rows including those with existing emails
 * 2. Each row fetches up to 3 URLs × 5-8s timeout = up to 24s per row
 * 3. 41 rows × 24s = ~16min worst case → n8n Cloud drops connection
 *
 * FIX 1: Insert "Filter Rows" between Get Row(s) and Loop Over Items
 *   - Skips rows that already have E-mail filled
 *   - Limits to 100 rows per run
 *
 * FIX 2: Reduce Fetch Website timeout 8s → 5s
 *
 * FIX 3: Add Connection: close header
 */

const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

  // ── FIX 1: Add "Filter Rows" node ──────────────────────────────────────────
  if (!wf.nodes.find(n => n.name === 'Filter Rows')) {
    wf.nodes.push({
      id: 'filter-rows-v14',
      name: 'Filter Rows',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [570, 300],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Filter Rows v1 — skip rows with existing email, limit per run
// Run multiple times to process all rows in a large sheet.
const ROWS_LIMIT = 100;

const items = $input.all();
const needsEmail = items.filter(item => !(item.json['E-mail'] || '').toString().trim());
const result = needsEmail.slice(0, ROWS_LIMIT);

console.log('[FilterRows] total=' + items.length + ' needs_email=' + needsEmail.length + ' processing=' + result.length);
return result;`
      }
    });
    console.log(`${file}: Added "Filter Rows" node`);
  } else {
    console.log(`${file}: "Filter Rows" already exists`);
  }

  // Rewire connections
  if (wf.connections['Get Row(s)']) {
    wf.connections['Get Row(s)'].main[0] = [{ node: 'Filter Rows', type: 'main', index: 0 }];
  }
  wf.connections['Filter Rows'] = {
    main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]]
  };
  console.log(`${file}: Get Row(s) → Filter Rows → Loop Over Items`);

  // ── FIX 2: timeout 5s ──────────────────────────────────────────────────────
  const fetchNode = wf.nodes.find(n => n.name === 'Fetch Website');
  if (fetchNode?.parameters?.options) {
    fetchNode.parameters.options.timeout = 5000;
    console.log(`${file}: timeout → 5000ms`);
  }

  // ── FIX 3: Connection: close ───────────────────────────────────────────────
  const headers = fetchNode?.parameters?.headerParameters?.parameters;
  if (headers) {
    const idx = headers.findIndex(h => (h.name || '').toLowerCase() === 'connection');
    if (idx === -1) headers.push({ name: 'Connection', value: 'close' });
    else headers[idx].value = 'close';
    console.log(`${file}: Connection: close set`);
  }

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`${file}: done\n`);
});
