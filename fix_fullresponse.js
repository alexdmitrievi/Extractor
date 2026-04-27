const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Fix Fetch Website:
  //    - fullResponse: false (default) = HTTP node adds 'html' to existing item, preserving ALL original fields
  //    - neverError: true = never throw, always continue (no more "hang" on 4xx/5xx/timeout)
  //    - continueOnFail: true = node-level error protection
  const fetch = wf.nodes.find(n => n.name === 'Fetch Website');
  fetch.continueOnFail = true;
  fetch.parameters.options.response.response = {
    responseFormat: 'text',
    outputPropertyName: 'html',
    fullResponse: false,
    neverError: true,
  };

  // 2. Simplify Normalize Response: with fullResponse:false+outputPropertyName:html,
  //    item already contains {html: "...", row_number, targetUrl, ...ALL original fields}
  //    So just clean up and return.
  const norm = wf.nodes.find(n => n.name === 'Normalize Response');
  norm.parameters.jsCode = `// Normalize Response v7
// With fullResponse:false + outputPropertyName:'html', HTTP Request node
// ADDS html property to the existing item WITHOUT removing original fields.
// So $json already has row_number, targetUrl, source_row_stable_key, etc.
const item = $input.item.json || {};

let html = item.html || '';
if (html && typeof html === 'object') {
  try { html = JSON.stringify(html); } catch(e) { html = String(html); }
}
if (typeof html !== 'string') html = html == null ? '' : String(html);

// statusCode: HTTP node doesn't expose it with fullResponse:false
// We set 200 if we got HTML, 0 otherwise (timeout/error sets empty html)
const statusCode = html.length > 0 ? 200 : 0;

return {
  json: {
    ...item,
    html,
    statusCode,
  },
};`;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f);
  // Verify
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const fn = v.nodes.find(n => n.name === 'Fetch Website');
  console.log('  continueOnFail:', fn.continueOnFail);
  console.log('  fullResponse:', fn.parameters.options.response.response.fullResponse);
  console.log('  neverError:', fn.parameters.options.response.response.neverError);
  console.log('  outputPropertyName:', fn.parameters.options.response.response.outputPropertyName);
}
