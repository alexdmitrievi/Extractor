const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Remove Debug Log and Save Original Data nodes (simplify)
  wf.nodes = wf.nodes.filter(n => n.name !== 'Debug Log' && n.name !== 'Save Original Data');
  delete wf.connections['Debug Log'];
  delete wf.connections['Save Original Data'];

  // 2. Restore Has URL? -> Fetch Website connection
  const hasUrlConns = wf.connections['Has URL?'];
  if (hasUrlConns && hasUrlConns.main && hasUrlConns.main[0]) {
    hasUrlConns.main[0][0].node = 'Fetch Website';
  }

  // 3. Change Fetch Website to fullResponse: true
  // fullResponse: true = HTTP Request adds statusCode, statusMessage, headers, body
  // AND preserves all original incoming fields
  const fetch = wf.nodes.find(n => n.name === 'Fetch Website');
  fetch.parameters.options.response.response = {
    responseFormat: 'text',
    fullResponse: true,
  };
  // Remove outputPropertyName since fullResponse handles it
  delete fetch.parameters.options.response.response.outputPropertyName;
  delete fetch.parameters.options.response.response.neverError;

  // 4. Rewrite Normalize Response: extract html from fullResponse body
  const norm = wf.nodes.find(n => n.name === 'Normalize Response');
  norm.parameters.jsCode = `// Normalize Response v6
// fullResponse: true means HTTP Request adds body, statusCode, headers
// and PRESERVES all original fields (row_number, targetUrl, etc.)
const item = $input.item.json || {};

// Extract HTML from fullResponse body
let html = item.body || item.html || '';
if (html && typeof html === 'object') {
  try { html = JSON.stringify(html); } catch(e) { html = String(html); }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

const statusCode = Number(item.statusCode || 0);

// Keep ALL fields from fullResponse (original data is preserved)
return {
  json: {
    ...item,
    html,
    statusCode,
    body: undefined,  // Remove raw body to save space
  },
};`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f + ': Simplified - fullResponse mode enabled');
}
