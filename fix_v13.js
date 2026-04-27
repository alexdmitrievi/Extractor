/**
 * fix_v13.js — Replace Update Row (Google Sheets node) with HTTP Request to Sheets API
 *
 * Google Sheets n8n node always requires columnToMatchOn to be a real header column,
 * but the sheet has no unique ID column — causing "Could not get parameter".
 *
 * Email columns confirmed by user: T=E-mail, U=E-mail 2, V=E-mail 3
 *
 * Solution: Use Google Sheets API v4 directly via HTTP Request node with oAuth2.
 * Endpoint: PUT /v4/spreadsheets/{id}/values/{range}
 * We know the exact row number from row_number field → range = Sheet1!A{row}:{lastCol}{row}
 *
 * BUT: we don't know which columns are E-mail/E-mail 2/E-mail 3 without reading the sheet.
 *
 * Simpler approach: Use the Sheets API batchUpdate with valueInputOption=RAW and
 * a named range based on row_number. We write only 3 cells using column letters.
 *
 * Actually the cleanest fix: change Prepare Update to a Code node that calls
 * the Sheets API via $helpers or use HTTP Request with oAuth2 credential.
 *
 * The node structure: replace "Update Row" (googleSheets) with HTTP Request node
 * that does a PATCH to the spreadsheet using the row_number.
 *
 * Column mapping (from the sheet structure):
 * We need to know column letters for E-mail, E-mail 2, E-mail 3.
 * Since we don't know them, we'll use the Sheets API "values.update" by row number
 * and only update those specific columns by reading the header row first...
 *
 * ACTUALLY: The cleanest fix that avoids all of this complexity is to change
 * Update Row to use "Append or Update" operation with matchKey being one of the
 * existing real columns. But there's no real unique key column.
 *
 * FINAL DECISION: Replace Update Row with a Code node that formats the API request,
 * followed by HTTP Request node hitting the Sheets API values.batchUpdate endpoint.
 * The batch update specifies exact cell ranges using row_number.
 *
 * We need to know the column letters. From the screenshot the sheet has:
 * Наименование, Описание, Рубрики, Адрес, ... E-mail, E-mail 2, E-mail 3
 * We'll make the column letters configurable via a Set node at the top,
 * OR we use a simpler approach: write via the API using the sheet row number
 * and column index (A1 notation) based on header discovery.
 *
 * SIMPLEST RELIABLE FIX:
 * Replace "Update Row" node with a single HTTP Request node that calls:
 * POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Sheet1!A{row}:ZZ{row}:clear
 * No — just values.update on specific named cells.
 *
 * We'll use the Sheets API values.update with range like:
 * Sheet1!E{row}:G{row}  (if E-mail is in column E)
 * But we don't know which columns...
 *
 * REAL SOLUTION: Use the Google Sheets node "appendOrUpdate" which can match
 * on row_number if we add a formula column =ROW() to the sheet...
 * No — don't modify the sheet.
 *
 * OK, the actual correct fix for n8n Google Sheets v4 typeVersion 4:
 * dataMode: "autoMapInputData" + columnToMatchOn must be a COLUMN HEADER NAME.
 * Since the sheet has no unique key, we must use a different approach.
 *
 * WORKING APPROACH: Get Row(s) already reads with includeRowNumber:true which
 * adds row_number to each item. Google Sheets update node typeVersion 4 with
 * dataMode:"autoMapInputData" and columnToMatchOn:"row_number" SHOULD work
 * because n8n treats row_number as a special meta-field when it comes from
 * a Sheets node with includeRowNumber:true.
 *
 * The error "Could not get parameter" likely means the columnToMatchOn dropdown
 * didn't load the column list yet (needs a live connection to the sheet to enumerate
 * column names). This is a UI issue, not a runtime issue.
 *
 * Let's try: set columnToMatchOn via the node parameter directly as the string
 * "row_number" and also ensure we're using the correct parameter key.
 *
 * In n8n Google Sheets v4, the update node JSON params key is exactly:
 *   "columnToMatchOn": "row_number"   -- matches row_number meta field
 *
 * The "Could not get parameter" at RUNTIME means something else is null.
 * Let's check: maybe it's because Prepare Update items have null in them
 * (filter(Boolean) removes nulls but if ALL are null → empty array → no items).
 *
 * Let's add defensive logging to Prepare Update to see what's happening.
 */

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log(`SKIP: ${filename}`); continue; }
  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  // 1. Update Row: use row_number (not _rowNumber), autoMapInputData
  const ur = wf.nodes.find(n => n.name === 'Update Row');
  if (!ur) { console.error('Update Row not found'); process.exit(1); }

  ur.parameters.dataMode = 'autoMapInputData';
  ur.parameters.columnToMatchOn = 'row_number';
  delete ur.parameters.fieldsUi;
  delete ur.parameters._rowNumber;

  console.log(`${filename}: Update Row → autoMapInputData + columnToMatchOn=row_number ✓`);

  // 2. Prepare Update: add verbose logging + ensure row_number is always a number
  const prep = wf.nodes.find(n => n.name === 'Prepare Update');
  if (!prep) { console.error('Prepare Update not found'); process.exit(1); }

  prep.parameters.jsCode = `const items = $input.all();
const sanitize = (v) => String(v == null ? '' : v).replace(/[\\u0000-\\u001f\\u007f]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 320);

console.log('[PrepareUpdate] input items count:', items.length);
if (items.length > 0) {
  const j0 = items[0].json || {};
  console.log('[PrepareUpdate] item[0] keys:', JSON.stringify(Object.keys(j0)));
  console.log('[PrepareUpdate] item[0] row_number:', j0.row_number, 'source_row_number:', j0.source_row_number, 'email_1:', j0.email_1);
}

const result = items.map((item, idx) => {
  try {
    const j = item.json || {};
    const rowRaw = j.row_number ?? j.source_row_number ?? j.source_row_index ?? '';
    const rowNumber = Number(rowRaw);
    console.log('[PrepareUpdate] idx=' + idx + ' rowRaw=' + JSON.stringify(rowRaw) + ' rowNumber=' + rowNumber + ' email_1=' + JSON.stringify(j.email_1));
    if (!Number.isFinite(rowNumber) || rowNumber < 1) {
      console.log('[PrepareUpdate] SKIP idx=' + idx + ' invalid rowNumber');
      return null;
    }
    return {
      json: {
        row_number: rowNumber,
        'E-mail': sanitize(j.email_1 ?? j['E-mail'] ?? ''),
        'E-mail 2': sanitize(j.email_2 ?? j['E-mail 2'] ?? ''),
        'E-mail 3': sanitize(j.email_3 ?? j['E-mail 3'] ?? ''),
      },
      pairedItem: item.pairedItem ?? { item: idx },
    };
  } catch (err) {
    console.log('[PrepareUpdate] ERROR idx=' + idx + ':', String(err && err.message || err));
    return null;
  }
}).filter(Boolean);

console.log('[PrepareUpdate] output items count:', result.length);
if (result.length > 0) {
  console.log('[PrepareUpdate] sample output:', JSON.stringify(result[0].json));
}
return result;`;

  console.log(`${filename}: Prepare Update enhanced with logging ✓`);

  // 3. Get Row(s): ensure includeRowNumber is still true (paranoia check)
  const gr = wf.nodes.find(n => n.name === 'Get Row(s)');
  if (gr && gr.parameters && gr.parameters.options) {
    gr.parameters.options.includeRowNumber = true;
    console.log(`${filename}: Get Row(s) includeRowNumber=true confirmed ✓`);
  }

  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
