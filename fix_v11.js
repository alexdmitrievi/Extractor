/**
 * fix_v11.js — Revert Update Row to autoMapInputData
 *
 * defineBelow + fieldsUi in n8n Google Sheets typeVersion 4 causes:
 *   "Could not get parameter"
 * because columnToMatchOn is not picked up from JSON and expressions in
 * fieldValue are not supported in that context.
 *
 * autoMapInputData works correctly because Prepare Update already outputs
 * the exact sheet column names: row_number, E-mail, E-mail 2, E-mail 3.
 */

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log(`SKIP: ${filename}`); continue; }
  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  const ur = wf.nodes.find(n => n.name === 'Update Row');
  if (!ur) { console.error('Update Row not found'); process.exit(1); }

  ur.parameters.dataMode = 'autoMapInputData';
  ur.parameters.columnToMatchOn = 'row_number';
  delete ur.parameters.fieldsUi;
  delete ur.parameters.autoMapInputData;

  console.log(`${filename}: Update Row → autoMapInputData, columnToMatchOn=row_number ✓`);

  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
