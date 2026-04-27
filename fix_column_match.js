const fs = require('fs');
const FILES = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of FILES) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ur = wf.nodes.find(n => n.name === 'Update Row');
  if (!ur) { console.error('Update Row not found'); process.exit(1); }

  // Use expression to bypass n8n dropdown validation for columnToMatchOn
  ur.parameters.columnToMatchOn = '={{ "row_number" }}';

  fs.writeFileSync(f, JSON.stringify(wf, null, 2), 'utf8');
  console.log(f + ': columnToMatchOn set as expression ✓');
}
