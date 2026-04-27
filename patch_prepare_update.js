// patch_prepare_update.js — write "—" marker when no email found

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

const OLD_NO_EMAIL = `  // No emails found — pass row_number only so Update Row does a harmless no-op
  if (!e1 && !e2 && !e3) {
    return { json: { row_number: row }, pairedItem: paired };
  }`;

const NEW_NO_EMAIL = `  // No emails found — write marker so Filter Rows skips this row on next run
  if (!e1 && !e2 && !e3) {
    console.log('[PrepareUpdate] row=' + row + ' no_email → marker');
    return { json: { row_number: row, 'E-mail': '—', 'E-mail 2': '', 'E-mail 3': '' }, pairedItem: paired };
  }`;

for (const file of FILES) {
  const raw = fs.readFileSync(file, 'utf8');
  const wf = JSON.parse(raw);

  const node = wf.nodes.find(n => n.name === 'Prepare Update');
  if (!node) { console.error(`[${file}] Prepare Update node not found`); continue; }

  const oldCode = node.parameters.jsCode;
  if (!oldCode.includes('pass row_number only')) {
    console.warn(`[${file}] Pattern not found — may already be patched`);
    continue;
  }

  node.parameters.jsCode = oldCode.replace(OLD_NO_EMAIL, NEW_NO_EMAIL);

  if (node.parameters.jsCode === oldCode) {
    console.error(`[${file}] Replacement failed`);
    continue;
  }

  // Also update Filter Rows to handle the "—" marker correctly
  // Current filter: !(item.json['E-mail'] || '').toString().trim()
  // "—" is truthy → already skipped correctly. No change needed.

  fs.writeFileSync(file, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`[${file}] Patched ✓`);
}

// Verify Filter Rows logic still works with "—"
console.log('\nVerify: Filter Rows with "—":');
const testEmail = '—';
const result = !(testEmail || '').toString().trim();
console.log('  email="—" → included in batch?', result, '(should be false = SKIPPED ✓)');
