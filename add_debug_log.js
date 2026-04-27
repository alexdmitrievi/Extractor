const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Add Debug Log node right after Has URL?
  const hasUrlNode = wf.nodes.find(n => n.name === 'Has URL?');
  
  // Check if Debug Log already exists
  let debugNode = wf.nodes.find(n => n.name === 'Debug Log');
  if (!debugNode) {
    const maxId = Math.max(...wf.nodes.map(n => Number(n.id) || 0));
    debugNode = {
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const url = $json.targetUrl || '(no-url)';
console.log('[DEBUG] Row ' + $json.row_number + ' -> Fetching: ' + url);
return { json: $json };`
      },
      id: String(maxId + 1),
      name: 'Debug Log',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [hasUrlNode.position[0] + 200, hasUrlNode.position[1]],
      continueOnFail: true
    };
    wf.nodes.push(debugNode);
    
    // Update connections: Has URL? -> Debug Log -> Fetch Website
    const hasUrlConns = wf.connections['Has URL?'];
    hasUrlConns.main[0][0].node = 'Debug Log';
    
    wf.connections['Debug Log'] = {
      main: [[{ node: 'Fetch Website', type: 'main', index: 0 }]]
    };
  }

  // 2. Fix Normalize Response: use $input.item.json directly (HTTP Request preserves all fields now)
  const normNode = wf.nodes.find(n => n.name === 'Normalize Response');
  normNode.parameters.jsCode = `// Normalize Response v3 - HTTP Request now preserves original fields
const httpJson = $input.item.json || {};

let html = httpJson.html || httpJson.body || '';
if (html && typeof html === 'object') {
  if (typeof html.body === 'string') {
    html = html.body;
  } else {
    try { html = JSON.stringify(html); } catch(e) { html = String(html); }
  }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

const statusCode = Number(httpJson.statusCode || httpJson.status || 0);

console.log('[NORMALIZE] row=' + httpJson.row_number + ' html_len=' + html.length + ' status=' + statusCode);

return {
  json: {
    ...httpJson,
    html,
    statusCode,
  },
};`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f + ': Debug Log added, Normalize Response fixed');
}
