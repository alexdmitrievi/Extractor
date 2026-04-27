const fs = require('fs');

const newCode = fs.readFileSync('select_url_v4.js', 'utf8');

const files = ['Astra_Email_Extractor_v2_FIXED.json', 'Astra_Email_Extractor_v1_FINAL.json'];
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const node = wf.nodes.find(n => n.name === 'Select URL');
  if (!node) throw new Error('Select URL node not found in ' + f);
  const oldVersion = (node.parameters.jsCode || '').match(/Select URL v\d+/)?.[0] || 'unknown';
  node.parameters.jsCode = newCode;
  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log('Patched', f, '— replaced', oldVersion, '-> Select URL v4');
}
