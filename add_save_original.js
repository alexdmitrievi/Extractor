const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Revert HTTP Request to simple mode (outputPropertyName: html, fullResponse: false)
  const fetch = wf.nodes.find(n => n.name === 'Fetch Website');
  fetch.parameters.options.response.response = {
    responseFormat: 'text',
    outputPropertyName: 'html',
    fullResponse: false,
    neverError: true,
  };

  // 2. Add "Save Original Data" node BEFORE Fetch Website (after Debug Log)
  // This Code node adds original_data field that survives through HTTP Request
  const debugLog = wf.nodes.find(n => n.name === 'Debug Log');
  let saveNode = wf.nodes.find(n => n.name === 'Save Original Data');
  
  if (!saveNode && debugLog) {
    const maxId = Math.max(...wf.nodes.map(n => Number(n.id) || 0));
    saveNode = {
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `// Save original row data before HTTP Request wipes it
const originalData = { 
  row_number: $json.row_number,
  source_row_index: $json.source_row_index,
  source_row_stable_key: $json.source_row_stable_key,
  source_row_number: $json.source_row_number,
  targetUrl: $json.targetUrl,
  targetHost: $json.targetHost,
};

// Keep ALL current fields + add marker
return { 
  json: { 
    ...$json, 
    _original_data: JSON.stringify(originalData) 
  } 
};`
      },
      id: String(maxId + 1),
      name: 'Save Original Data',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [debugLog.position[0] + 200, debugLog.position[1]],
      continueOnFail: true
    };
    wf.nodes.push(saveNode);
    
    // Update connections: Debug Log -> Save Original Data -> Fetch Website
    wf.connections['Debug Log'].main[0][0].node = 'Save Original Data';
    wf.connections['Save Original Data'] = {
      main: [[{ node: 'Fetch Website', type: 'main', index: 0 }]]
    };
  }

  // 3. Update Normalize Response to restore from _original_data
  const norm = wf.nodes.find(n => n.name === 'Normalize Response');
  norm.parameters.jsCode = `// Normalize Response v5
// HTTP Request outputs {html: "...", ...all_original_fields_if_they_survived}
// But to be safe, we restore critical fields from _original_data
const httpJson = $input.item.json || {};

// Parse restored data if it exists
let restored = {};
if (httpJson._original_data) {
  try { restored = JSON.parse(httpJson._original_data); } catch(e) {}
}

let html = httpJson.html || httpJson.body || '';
if (html && typeof html === 'object') {
  try { html = JSON.stringify(html); } catch(e) { html = String(html); }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

const statusCode = Number(httpJson.statusCode || 0);

const result = { ...restored, ...httpJson, html, statusCode };
delete result._original_data;
delete result.body;

console.log('[NORM] row=' + result.row_number + ' html=' + (html.length > 0 ? 'YES' : 'NO'));

return { json: result };`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f + ': Save Original Data node added');
}
