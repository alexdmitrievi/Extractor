const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Extract Emails: write E-mail / E-mail 2 / E-mail 3 fields directly
  const extractNode = wf.nodes.find(n => n.name === 'Extract Emails');
  const old = '  mergedJson.email_1 = final1;\n  mergedJson.email_2 = final2;\n  mergedJson.email_3 = final3;';
  const replacement = [
    '  mergedJson.email_1 = final1;',
    '  mergedJson.email_2 = final2;',
    '  mergedJson.email_3 = final3;',
    '  // Write to exact sheet column names so autoMapInputData maps them correctly',
    "  mergedJson['E-mail'] = final1;",
    "  mergedJson['E-mail 2'] = final2;",
    "  mergedJson['E-mail 3'] = final3;",
  ].join('\n');

  if (!extractNode.parameters.jsCode.includes(old)) {
    console.error('ERROR: marker not found in ' + f);
    console.error('Looking for:', JSON.stringify(old));
    process.exit(1);
  }
  extractNode.parameters.jsCode = extractNode.parameters.jsCode.replace(old, replacement);

  // 2. Update Row: switch to autoMapInputData — no fieldsUi needed, n8n maps by column name
  const updateNode = wf.nodes.find(n => n.name === 'Update Row');
  updateNode.parameters.dataMode = 'autoMapInputData';
  delete updateNode.parameters.fieldsUi;

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));

  // Verify
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const un = v.nodes.find(n => n.name === 'Update Row');
  const en = v.nodes.find(n => n.name === 'Extract Emails');
  const hasEMail = en.parameters.jsCode.includes("mergedJson['E-mail'] = final1");
  console.log(f);
  console.log('  Update Row dataMode:', un.parameters.dataMode, '| fieldsUi:', un.parameters.fieldsUi);
  console.log('  Extract Emails has E-mail field:', hasEMail);
}
