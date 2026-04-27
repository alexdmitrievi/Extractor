const fs = require('fs');

const fetchCode = fs.readFileSync('fetch_website_code.js', 'utf8');

const files = ['Astra_Email_Extractor_v2_FIXED.json', 'Astra_Email_Extractor_v1_FINAL.json'];
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const node = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!node) throw new Error('Fetch Website node not found in ' + f);

  // Save original position and id
  const { id, position, continueOnFail } = node;

  // Replace the entire node with a Code node
  node.type = 'n8n-nodes-base.code';
  node.typeVersion = 2;
  // Remove HTTP Request specific params
  delete node.parameters.method;
  delete node.parameters.url;
  delete node.parameters.authentication;
  delete node.parameters.sendHeaders;
  delete node.parameters.headerParameters;
  delete node.parameters.sendQuery;
  delete node.parameters.sendBody;
  delete node.parameters.options;
  // Set Code node params
  node.parameters = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: fetchCode,
  };
  // Restore position etc
  node.id = id;
  node.position = position;
  if (continueOnFail !== undefined) node.continueOnFail = continueOnFail;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log('Patched', f, '— Fetch Website: httpRequest -> code node');
}
