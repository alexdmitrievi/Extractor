const fs = require('fs');
const FILES = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of FILES) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const urIdx = wf.nodes.findIndex(n => n.name === 'Update Row');
  const oldPos = wf.nodes[urIdx].position;

  const grNode = wf.nodes.find(n => n.name === 'Get Row(s)');
  const grCreds = grNode && grNode.credentials && grNode.credentials.googleSheetsOAuth2Api;

  const newNode = {
    parameters: {
      authentication: 'oAuth2',
      resource: 'sheet',
      operation: 'update',
      documentId: { mode: 'id', value: '1RDa3Ui_N4wXK5tzeeyNoXjUknjFoT7S62D_j38MyEjk' },
      sheetName: { mode: 'name', value: 'Sheet1' },
      dataMode: 'autoMapInputData',
      columnToMatchOn: 'row_number',
      options: { valueInputMode: 'RAW' }
    },
    id: 'update-row-sheets',
    name: 'Update Row',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 4,
    position: oldPos,
    continueOnFail: true,
    onError: 'continueRegularOutput',
  };

  if (grCreds) {
    newNode.credentials = { googleSheetsOAuth2Api: grCreds };
  }

  wf.nodes[urIdx] = newNode;
  fs.writeFileSync(f, JSON.stringify(wf, null, 2), 'utf8');
  console.log(f + ': Update Row restored to Google Sheets node, columnToMatchOn=row_number, creds=' + JSON.stringify(grCreds));
}
