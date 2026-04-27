/**
 * fix_loop_single_path.js
 *
 * ROOT CAUSE: Cleanup is triggered 3 times per batch:
 *   1. Has new emails?[1] → Cleanup (false branch)
 *   2. Update Row[0]      → Cleanup (after update)
 *   3. Log Skipped[0]     → Cleanup
 * → Throttle fires 3x → Loop fires 3x → skips most rows
 *
 * FIX: Remove all branching from the loop body. Single linear path:
 *   Loop[1] → Select URL → Fetch Website → Normalize Response
 *          → Extract Emails → Prepare Update → Update Row
 *          → Cleanup → Throttle → Loop
 *
 * Dead nodes (disconnected but kept in JSON):
 *   Has Empty Email Slot?, Mark No URL, Has URL?,
 *   Progress Log, Has row_number?, Log Skipped, Has new emails?
 */

const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = wf.connections;

  // ─── 1. Rewire Loop Over Items[1] → Select URL (was → Has Empty Email Slot?) ───
  if (c['Loop Over Items'] && c['Loop Over Items'].main && c['Loop Over Items'].main[1]) {
    c['Loop Over Items'].main[1] = [{ node: 'Select URL', type: 'main', index: 0 }];
  }

  // ─── 2. Rewire Select URL[0] → Fetch Website (was → Has URL?) ────────────────
  if (c['Select URL']) {
    c['Select URL'].main = [[{ node: 'Fetch Website', type: 'main', index: 0 }]];
  }

  // ─── 3. Rewire Extract Emails[0] → Prepare Update (was → Progress Log) ───────
  if (c['Extract Emails']) {
    c['Extract Emails'].main = [[{ node: 'Prepare Update', type: 'main', index: 0 }]];
  }

  // ─── 4. Remove now-dead connections (clear them to avoid confusion) ───────────
  // Has Empty Email Slot? → both outputs obsolete
  if (c['Has Empty Email Slot?']) delete c['Has Empty Email Slot?'];
  // Has URL? → both outputs obsolete
  if (c['Has URL?']) delete c['Has URL?'];
  // Mark No URL → obsolete
  if (c['Mark No URL']) delete c['Mark No URL'];
  // Progress Log → obsolete
  if (c['Progress Log']) delete c['Progress Log'];
  // Has row_number? → obsolete
  if (c['Has row_number?']) delete c['Has row_number?'];
  // Log Skipped → obsolete
  if (c['Log Skipped']) delete c['Log Skipped'];
  // Has new emails? → obsolete
  if (c['Has new emails?']) delete c['Has new emails?'];

  // ─── 5. Fix Prepare Update node code ─────────────────────────────────────────
  const prepNode = wf.nodes.find(n => n.name === 'Prepare Update');
  if (prepNode) {
    prepNode.parameters.jsCode = `
// Prepare Update v3 — Single-path architecture
// Always returns an item for every input (never filters to null).
// Items with emails → full update; items without → pass-through {row_number} only.
const items = $input.all();
const san = v => String(v == null ? '' : v).replace(/[\\u0000-\\u001f\\u007f]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 320);

const out = items.map((item, idx) => {
  const j = item.json || {};
  const row = Number(j.row_number ?? j.source_row_number ?? j.source_row_index ?? 0);
  const e1 = san(j.email_1 ?? j['E-mail'] ?? '');
  const e2 = san(j.email_2 ?? j['E-mail 2'] ?? '');
  const e3 = san(j.email_3 ?? j['E-mail 3'] ?? '');
  const paired = item.pairedItem ?? { item: idx };

  // No valid row number — pass a sentinel so Update Row fails gracefully and continues
  if (!Number.isFinite(row) || row < 1) {
    return { json: { row_number: null, __skip: true }, pairedItem: paired };
  }

  // No emails found — pass row_number only so Update Row does a harmless no-op
  if (!e1 && !e2 && !e3) {
    return { json: { row_number: row }, pairedItem: paired };
  }

  // Has emails — prepare full update
  const result = { json: { row_number: row, 'E-mail': e1, 'E-mail 2': e2, 'E-mail 3': e3 }, pairedItem: paired };
  console.log('[PrepareUpdate] row=' + row + ' email_1=' + e1);
  return result;
}).filter(Boolean);

console.log('[PrepareUpdate] in=' + items.length + ' out=' + out.length);
return out;
`.trim();
    delete prepNode.parameters.code;
  }

  // ─── 6. Fix Normalize Response — change $('Has URL?') to $('Select URL') ──────
  const normNode = wf.nodes.find(n => n.name === 'Normalize Response');
  if (normNode) {
    const key = normNode.parameters.jsCode ? 'jsCode' : 'code';
    normNode.parameters[key] = normNode.parameters[key].replace(
      /\$\(['"]Has URL\?['"]\)\.item\.json/g,
      "$('Select URL').item.json"
    );
    console.log('  Normalize Response: replaced $("Has URL?") with $("Select URL")');
  }

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(file + ': done — single-path loop, connections rewired');
});
