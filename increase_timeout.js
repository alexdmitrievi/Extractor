const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Increase HTTP timeout to 60 seconds (from 20)
  const fetch = wf.nodes.find(n => n.name === 'Fetch Website');
  fetch.parameters.options.timeout = 60000;

  // 2. Ensure neverError and continueOnFail are set
  fetch.parameters.options.response.response.neverError = true;
  fetch.continueOnFail = true;

  // 3. Add "Check HTML" safety node after Fetch Website to ensure HTTP request completed
  // This will catch any timeout or abort issues early
  const normNode = wf.nodes.find(n => n.name === 'Normalize Response');
  let checkNode = wf.nodes.find(n => n.name === 'Check HTML');
  
  if (!checkNode && normNode) {
    const maxId = Math.max(...wf.nodes.map(n => Number(n.id) || 0));
    checkNode = {
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `// Check if HTTP request actually completed
const hasHtml = !!($json.html && $json.html.length > 0);
const status = Number($json.statusCode || 0);
const url = $json.targetUrl || '';

if (!hasHtml && !url) {
  console.log('[CHECK] Row ' + $json.row_number + ': no URL, skipping');
  return { json: $json };
}

if (!hasHtml && status > 0) {
  console.log('[CHECK] Row ' + $json.row_number + ': HTTP error ' + status + ' for ' + url);
} else if (!hasHtml) {
  console.log('[CHECK] Row ' + $json.row_number + ': timeout or no response for ' + url);
} else {
  console.log('[CHECK] Row ' + $json.row_number + ': OK, html=' + hasHtml.length + ' bytes');
}

return { json: $json };`
      },
      id: String(maxId + 1),
      name: 'Check HTML',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [normNode.position[0] - 200, normNode.position[1]],
      continueOnFail: true
    };
    wf.nodes.push(checkNode);
    
    // Update connections: Fetch Website -> Check HTML -> Normalize Response
    wf.connections['Fetch Website'].main[0][0].node = 'Check HTML';
    wf.connections['Check HTML'] = {
      main: [[{ node: 'Normalize Response', type: 'main', index: 0 }]]
    };
  }

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log(f + ': Timeout increased to 60s, Check HTML node added');
}
