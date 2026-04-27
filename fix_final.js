const fs = require('fs');
const FILES = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of FILES) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ur = wf.nodes.find(n => n.name === 'Update Row');
  if (!ur) { console.error('Not found'); process.exit(1); }

  // Clean slate — only the necessary params
  ur.type = 'n8n-nodes-base.googleSheets';
  ur.typeVersion = 4;
  ur.parameters = {
    authentication: 'oAuth2',
    resource: 'sheet',
    operation: 'update',
    documentId: { mode: 'id', value: '1RDa3Ui_N4wXK5tzeeyNoXjUknjFoT7S62D_j38MyEjk' },
    sheetName: { mode: 'name', value: 'Sheet1' },
    dataMode: 'autoMapInputData',
    columnToMatchOn: 'row_number',
    options: { valueInputMode: 'RAW' },
  };
  delete ur.credentials; // will be set manually in n8n UI

  fs.writeFileSync(f, JSON.stringify(wf, null, 2), 'utf8');
  console.log(f + ': done — dataMode=autoMapInputData, columnToMatchOn=row_number (plain string)');
}
