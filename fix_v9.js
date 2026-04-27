/**
 * fix_v9.js — three fixes:
 *
 * Fix 1: Update Row → dataMode: defineBelow + explicit field expressions
 *         autoMapInputData is unreliable when sheet column names don't match perfectly
 *
 * Fix 2: Throttle (Wait) → Code pass-through
 *         Wait node webhook is consumed after the FIRST loop iteration; subsequent
 *         iterations hang waiting for a webhook that never fires.
 *
 * Fix 3: Has Empty Email Slot? false → Mark No URL  (was: → Cleanup)
 *         When some items in a batch skip processing (all slots filled) and others
 *         take the full fetch-extract path, Cleanup fires from two separate branches
 *         at different times → Loop gets double-triggered → batches are skipped or lost.
 *         Routing via Mark No URL forces all items through the same eventual path
 *         to Cleanup, so Cleanup always fires exactly ONCE per batch.
 */

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log(`SKIP (not found): ${filename}`); continue; }

  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  /* ─── Fix 1: Update Row ──────────────────────────────────────────────── */
  const updateNode = wf.nodes.find(n => n.name === 'Update Row');
  if (!updateNode) { console.error('Update Row node not found!'); process.exit(1); }

  updateNode.parameters.dataMode = 'defineBelow';
  // Remove autoMapInputData artifacts
  delete updateNode.parameters.autoMapInputData;

  updateNode.parameters.fieldsUi = {
    fieldValues: [
      {
        fieldId: 'E-mail',
        fieldValue: "={{ $json[\"E-mail\"] || $json[\"email_1\"] || '' }}",
      },
      {
        fieldId: 'E-mail 2',
        fieldValue: "={{ $json[\"E-mail 2\"] || $json[\"email_2\"] || '' }}",
      },
      {
        fieldId: 'E-mail 3',
        fieldValue: "={{ $json[\"E-mail 3\"] || $json[\"email_3\"] || '' }}",
      },
    ],
  };

  console.log(`${filename}: Fix 1 (Update Row defineBelow) — OK`);

  /* ─── Fix 2: Throttle Wait → Code pass-through ────────────────────────── */
  const throttleNode = wf.nodes.find(n => n.name === 'Throttle');
  if (!throttleNode) { console.error('Throttle node not found!'); process.exit(1); }

  throttleNode.type = 'n8n-nodes-base.code';
  throttleNode.typeVersion = 2;
  throttleNode.parameters = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode:
      '// Throttle v2 — simple pass-through.\n' +
      '// The Wait node webhook is consumed after the first loop iteration,\n' +
      '// causing the workflow to hang on subsequent batches.\n' +
      '// HTTP requests already provide natural rate-limiting; no artificial delay needed.\n' +
      'return $input.all().map(() => ({ json: {} }));',
  };
  delete throttleNode.webhookId;
  throttleNode.continueOnFail = true;

  console.log(`${filename}: Fix 2 (Throttle Wait → Code) — OK`);

  /* ─── Fix 3: Has Empty Email Slot? false → Mark No URL ──────────────────── */
  const conn = wf.connections['Has Empty Email Slot?'];
  if (!conn || !conn.main || !conn.main[1]) {
    console.error('Has Empty Email Slot? connections not found!');
    process.exit(1);
  }

  // output[1] = false branch
  const falseBranch = conn.main[1];
  const wasCleanup = falseBranch.some(e => e.node === 'Cleanup');
  const wasMarkNoUrl = falseBranch.some(e => e.node === 'Mark No URL');

  if (wasMarkNoUrl) {
    console.log(`${filename}: Fix 3 — already routes to Mark No URL, skip`);
  } else {
    // Replace Cleanup with Mark No URL in the false branch
    conn.main[1] = falseBranch
      .filter(e => e.node !== 'Cleanup')
      .concat([{ node: 'Mark No URL', type: 'main', index: 0 }]);

    const was = wasCleanup ? 'Cleanup' : JSON.stringify(falseBranch.map(e => e.node));
    console.log(`${filename}: Fix 3 (Has Empty Email Slot? false: ${was} → Mark No URL) — OK`);
  }

  /* ─── Write ─────────────────────────────────────────────────────────── */
  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
