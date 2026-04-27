const fs = require('fs');
const files = ['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'];

for (const f of files) {
  const wf = JSON.parse(fs.readFileSync(f, 'utf8'));

  // 1. Fix "Has new emails?" condition:
  //    OLD: new_emails_count > 0 (never true when email already existed in sheet)
  //    NEW: email_1 is not empty (write whenever we have ANY email to put in the sheet)
  const hasNewEmails = wf.nodes.find(n => n.name === 'Has new emails?');
  hasNewEmails.parameters = {
    conditions: {
      string: [
        {
          value1: '={{ ($json["email_1"] || "").toString().trim() }}',
          operation: 'isNotEmpty',
          value2: '',
        },
      ],
    },
    combineOperation: 'all',
  };

  // 2. Add continueOnFail to all nodes that might throw
  const criticalNodes = [
    'Select URL', 'Has URL?', 'Fetch Website', 'Normalize Response',
    'Extract Emails', 'Progress Log', 'Has row_number?', 'Has new emails?',
    'Prepare Update', 'Update Row', 'Log Skipped', 'Cleanup',
  ];
  for (const name of criticalNodes) {
    const node = wf.nodes.find(n => n.name === name);
    if (node) node.continueOnFail = true;
  }

  // 3. Fix Extract Emails: the hasFetchError / success detection
  //    With neverError:true, statusCode is always 0 (not in output).
  //    Normalize Response v7 sets statusCode = html.length > 0 ? 200 : 0
  //    Extract Emails checks: (!htmlRaw && fetchedUrl) → hasFetchError
  //    This is fine. But also update the bucket success check:
  const extractNode = wf.nodes.find(n => n.name === 'Extract Emails');
  const oldSuccessCheck = `const isSuccess = htmlRaw.length > 0 && (!statusCode || statusCode < 400);`;
  const newSuccessCheck = `const isSuccess = htmlRaw.length > 100;  // Has meaningful content`;
  if (extractNode.parameters.jsCode.includes(oldSuccessCheck)) {
    extractNode.parameters.jsCode = extractNode.parameters.jsCode.replace(oldSuccessCheck, newSuccessCheck);
    console.log(f + ': Fixed isSuccess check');
  }

  fs.writeFileSync(f, JSON.stringify(wf, null, 2));

  // Verify
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  const hn = v.nodes.find(n => n.name === 'Has new emails?');
  console.log(f);
  console.log('  Has new emails? condition:', JSON.stringify(hn.parameters.conditions));
}
