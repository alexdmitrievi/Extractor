/**
 * fix_v12.js
 *
 * "The 'Column to Match On' parameter is required"
 *
 * Root cause: columnToMatchOn: "row_number" fails because n8n Google Sheets v4
 * validates the column name against actual sheet headers at execution time.
 * "row_number" is a VIRTUAL n8n field (added by includeRowNumber:true) — it is
 * NOT a real column in the spreadsheet, so the validation fails.
 *
 * Fix: Use "_rowNumber" — n8n's reserved identifier for the spreadsheet row number.
 *   - Update Row: columnToMatchOn → "_rowNumber"
 *   - Prepare Update: output "_rowNumber" field (in addition to row_number)
 *
 * n8n Google Sheets v4 docs: "To update by row number, set Column to Match On
 * to _rowNumber and provide the row number in the item's _rowNumber field."
 */

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log(`SKIP: ${filename}`); continue; }
  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  /* ─── Fix Update Row: columnToMatchOn → _rowNumber ──────────────────── */
  const ur = wf.nodes.find(n => n.name === 'Update Row');
  if (!ur) { console.error('Update Row not found'); process.exit(1); }

  ur.parameters.columnToMatchOn = '_rowNumber';
  ur.parameters.dataMode = 'autoMapInputData';
  delete ur.parameters.fieldsUi;

  console.log(`${filename}: Update Row columnToMatchOn → _rowNumber ✓`);

  /* ─── Fix Prepare Update: add _rowNumber field ───────────────────────── */
  const prep = wf.nodes.find(n => n.name === 'Prepare Update');
  if (!prep) { console.error('Prepare Update not found'); process.exit(1); }

  prep.parameters.jsCode = `const items = $input.all();
const sanitize = (v) => String(v == null ? '' : v).replace(/[\\u0000-\\u001f\\u007f]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 320);
return items.map((item, idx) => {
  try {
    const j = item.json || {};
    const rowRaw = j.row_number ?? j.source_row_number ?? '';
    const rowNumber = Number(rowRaw);
    if (!Number.isFinite(rowNumber) || rowNumber < 1) return null;
    return {
      json: {
        // _rowNumber is n8n's reserved identifier for the actual spreadsheet row.
        // columnToMatchOn: "_rowNumber" in Update Row matches by this value.
        _rowNumber: rowNumber,
        row_number: rowNumber,  // keep for logging/debugging
        'E-mail': sanitize(j.email_1),
        'E-mail 2': sanitize(j.email_2),
        'E-mail 3': sanitize(j.email_3),
      },
      pairedItem: item.pairedItem ?? { item: idx },
    };
  } catch (err) {
    return null;
  }
}).filter(Boolean);`;

  console.log(`${filename}: Prepare Update adds _rowNumber ✓`);

  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
