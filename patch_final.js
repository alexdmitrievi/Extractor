const fs = require('fs');

// Original HTTP Request node config — works in ALL n8n versions
const httpRequestParams = {
  method: 'GET',
  url: '={{ $json["targetUrl"] }}',
  authentication: 'none',
  sendHeaders: true,
  headerParameters: {
    parameters: [
      { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' },
      { name: 'Accept', value: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' },
      { name: 'Accept-Language', value: 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' },
      { name: 'Accept-Encoding', value: 'gzip, deflate' },
      { name: 'Cache-Control', value: 'no-cache' },
      { name: 'Pragma', value: 'no-cache' },
    ],
  },
  options: {
    timeout: 20000,
    allowUnauthorizedCerts: true,
    redirect: { redirect: { followRedirects: true, maxRedirects: 5 } },
    response: {
      response: {
        responseFormat: 'text',
        outputPropertyName: 'html',
        fullResponse: false,
        neverError: true,
      },
    },
  },
};

// Normalize Response v2 — runOnceForEachItem
// HTTP Request node only outputs {html:"..."}, losing all original row fields.
// We recover them from "Has URL?" upstream node via $('Has URL?').item.json
const normalizeCode = `// Normalize Response v2
// HTTP Request node outputs only {html:"..."}, losing row_number, targetUrl, etc.
// We restore original data from the "Has URL?" node (last node before the HTTP request).
const httpJson = $input.item.json || {};
const originalJson = $('Has URL?').item.json || {};

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

return {
  json: {
    ...originalJson,
    html,
    statusCode,
  },
};`;

const files = ['Astra_Email_Extractor_v2_FIXED.json', 'Astra_Email_Extractor_v1_FINAL.json'];
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Revert Fetch Website → HTTP Request node
  const fetchNode = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!fetchNode) throw new Error('Fetch Website not found in ' + f);
  fetchNode.type = 'n8n-nodes-base.httpRequest';
  fetchNode.typeVersion = 4;
  fetchNode.parameters = httpRequestParams;
  fetchNode.continueOnFail = true;
  delete fetchNode.parameters.mode;
  delete fetchNode.parameters.language;
  delete fetchNode.parameters.jsCode;

  // 2. Update Normalize Response → runOnceForEachItem + merge with Has URL? data
  const normNode = wf.nodes.find(n => n.name === 'Normalize Response');
  if (!normNode) throw new Error('Normalize Response not found in ' + f);
  normNode.parameters = {
    mode: 'runOnceForEachItem',
    language: 'javaScript',
    jsCode: normalizeCode,
  };

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));

  // Verify
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const fn = v.nodes.find(n => n.name === 'Fetch Website');
  const nn = v.nodes.find(n => n.name === 'Normalize Response');
  console.log(f);
  console.log('  Fetch Website: type=' + fn.type + ' typeVersion=' + fn.typeVersion);
  console.log('  Normalize Response: mode=' + nn.parameters.mode);
}
