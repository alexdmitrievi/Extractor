const fs = require('fs');
const FILES = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];
const SPREADSHEET_ID = '1RDa3Ui_N4wXK5tzeeyNoXjUknjFoT7S62D_j38MyEjk';

// Prepare Update code — outputs row_number + email fields
const PREPARE_CODE = `const items = $input.all();
const san = v => String(v == null ? '' : v).replace(/[\\u0000-\\u001f\\u007f]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 320);
const out = items.map((item, idx) => {
  const j = item.json || {};
  const row = Number(j.row_number ?? j.source_row_number ?? j.source_row_index ?? 0);
  if (!Number.isFinite(row) || row < 1) return null;
  const e1 = san(j.email_1 ?? j['E-mail'] ?? '');
  const e2 = san(j.email_2 ?? j['E-mail 2'] ?? '');
  const e3 = san(j.email_3 ?? j['E-mail 3'] ?? '');
  if (!e1 && !e2 && !e3) return null;
  return {
    json: { row_number: row, 'E-mail': e1, 'E-mail 2': e2, 'E-mail 3': e3 },
    pairedItem: item.pairedItem ?? { item: idx },
  };
}).filter(Boolean);
console.log('[PrepareUpdate] in:', items.length, 'out:', out.length, out.length ? JSON.stringify(out[0].json) : '');
return out;`;

// HTTP Request body expression for Sheets API batchUpdate
// Columns: T=E-mail, U=E-mail 2, V=E-mail 3
const BODY_EXPRESSION = `={{ JSON.stringify({
  valueInputOption: "USER_ENTERED",
  data: [{
    range: "Sheet1!T" + $json["row_number"] + ":V" + $json["row_number"],
    values: [[
      ($json["E-mail"] || ""),
      ($json["E-mail 2"] || ""),
      ($json["E-mail 3"] || "")
    ]]
  }]
}) }}`;

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log('SKIP:', filename); continue; }
  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  // Get OAuth2 credential ID/name from Get Row(s)
  const getRowsNode = wf.nodes.find(n => n.name === "Get Row(s)");
  const oauthCred = getRowsNode && getRowsNode.credentials && getRowsNode.credentials.googleSheetsOAuth2Api;

  // Replace Update Row node
  const urIdx = wf.nodes.findIndex(n => n.name === 'Update Row');
  if (urIdx === -1) { console.error('Update Row not found in', filename); process.exit(1); }
  const oldPos = wf.nodes[urIdx].position;

  const newUpdateNode = {
    parameters: {
      authentication: 'oAuth2',
      url: `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
      method: 'POST',
      sendBody: true,
      contentType: 'json',
      body: BODY_EXPRESSION,
      options: {},
    },
    id: 'update-row-api',
    name: 'Update Row',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    position: oldPos,
    continueOnFail: true,
    onError: 'continueRegularOutput',
  };

  if (oauthCred) {
    newUpdateNode.credentials = { oAuth2Api: oauthCred };
  }

  wf.nodes[urIdx] = newUpdateNode;
  console.log(`${filename}: Update Row → HTTP Request (Sheets batchUpdate), credentials:`, JSON.stringify(oauthCred));

  // Fix Prepare Update
  const prep = wf.nodes.find(n => n.name === 'Prepare Update');
  if (!prep) { console.error('Prepare Update not found in', filename); process.exit(1); }
  prep.parameters.jsCode = PREPARE_CODE;
  console.log(`${filename}: Prepare Update fixed`);

  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
