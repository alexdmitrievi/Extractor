const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // Update Fetch Website HTTP Request node
  const fetch = wf.nodes.find(n => n.name === 'Fetch Website');
  
  // Change to fullResponse: true + use Code node to extract HTML
  fetch.parameters.options.response.response = {
    responseFormat: 'text',
    fullResponse: true,  // Preserve original JSON + add response data
  };

  // Remove outputPropertyName since fullResponse will add everything
  delete fetch.parameters.options.response.response.outputPropertyName;

  // Update Normalize Response to handle fullResponse output
  const norm = wf.nodes.find(n => n.name === 'Normalize Response');
  norm.parameters.jsCode = `// Normalize Response v4 - fullResponse:true means HTTP response is in \$input.item.json.body
const httpJson = $input.item.json || {};

// fullResponse: true adds: .statusCode, .statusMessage, .headers, .body (text), and keeps original fields
let html = httpJson.body || httpJson.html || '';

if (html && typeof html === 'object') {
  if (typeof html.body === 'string') {
    html = html.body;
  } else {
    try { html = JSON.stringify(html); } catch(e) { html = String(html); }
  }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

const statusCode = Number(httpJson.statusCode || 0);

console.log('[NORMALIZE] row=' + httpJson.row_number + ' html_len=' + html.length + ' status=' + statusCode);

// Preserve ALL original fields + replace body with extracted html
const result = { ...httpJson };
delete result.body;  // Remove raw response body
result.html = html;
result.statusCode = statusCode;

return { json: result };`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f + ': HTTP Request changed to fullResponse:true');
}
