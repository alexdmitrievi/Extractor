const fs = require('fs');

const newCode = fs.readFileSync('fetch_website_code_v2.js', 'utf8');

const files = ['Astra_Email_Extractor_v2_FIXED.json', 'Astra_Email_Extractor_v1_FINAL.json'];
for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const node = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!node) throw new Error('Fetch Website node not found in ' + f);

  node.parameters = {
    mode: 'runOnceForEachItem',
    language: 'javaScript',
    jsCode: newCode,
  };

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  console.log('Patched', f, '— Fetch Website: runOnceForAllItems -> runOnceForEachItem (v2)');

  // Verify
  const verify = JSON.parse(fs.readFileSync(f, 'utf8'));
  const vnode = verify.nodes.find(n => n.name === 'Fetch Website');
  console.log('  mode:', vnode.parameters.mode, '| type:', vnode.type);
}
