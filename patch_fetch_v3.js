const fs = require('fs');
const newCode = fs.readFileSync('fetch_website_code_v3.js', 'utf8');
const files = ['Astra_Email_Extractor_v2_FIXED.json', 'Astra_Email_Extractor_v1_FINAL.json'];
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const node = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!node) throw new Error('Fetch Website not found in ' + f);
  node.parameters = { mode: 'runOnceForEachItem', language: 'javaScript', jsCode: newCode };
  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const vn = v.nodes.find(n => n.name === 'Fetch Website');
  console.log(f, '| mode:', vn.parameters.mode, '| starts with:', vn.parameters.jsCode.slice(0, 60));
}
