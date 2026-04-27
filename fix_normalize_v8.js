const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // ROOT CAUSE: HTTP Request with outputPropertyName:'html' REPLACES item.json entirely
  // with {html:"..."} — all original fields (row_number, E-mail, source_row_stable_key) are LOST.
  // FIX: Recover original data from $('Has URL?').item.json in Normalize Response.
  // This works because Has URL? -> Fetch Website -> Normalize Response is a strict 1:1 chain.
  const norm = wf.nodes.find(n => n.name === 'Normalize Response');
  norm.parameters.jsCode = `// Normalize Response v8
// HTTP Request with outputPropertyName:'html' REPLACES item.json entirely.
// We recover original data (row_number, E-mail, targetUrl, etc.) from Has URL? node.
const httpJson = $input.item.json || {};
const originalJson = $('Has URL?').item.json || {};

let html = httpJson.html || httpJson.body || '';
if (html && typeof html === 'object') {
  try { html = JSON.stringify(html); } catch(e) { html = String(html); }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

const statusCode = html.length > 0 ? 200 : 0;

return {
  json: {
    ...originalJson,
    html,
    statusCode,
  },
};`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));

  // Verify
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const nn = v.nodes.find(n => n.name === 'Normalize Response');
  console.log(f + ': Normalize Response v8 — uses $("Has URL?").item.json:', nn.parameters.jsCode.includes("$('Has URL?')"));
}
