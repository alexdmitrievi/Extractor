// fix_v17.js — Add ROWS_LIMIT=100 back to Filter Rows for reliable runs

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

const OLD_FILTER = `// Filter Rows v2 — skip rows that already have email, process ALL remaining
const items = $input.all();
const needsEmail = items.filter(item => !(item.json['E-mail'] || '').toString().trim());
console.log('[FilterRows] total=' + items.length + ' needs_email=' + needsEmail.length);
return needsEmail;`;

const NEW_FILTER = `// Filter Rows v3 — skip rows that already have email, cap at ROWS_LIMIT per run
const ROWS_LIMIT = 100;
const items = $input.all();
const needsEmail = items.filter(item => !(item.json['E-mail'] || '').toString().trim());
const batch = needsEmail.slice(0, ROWS_LIMIT);
console.log('[FilterRows] total=' + items.length + ' needs_email=' + needsEmail.length + ' this_run=' + batch.length);
return batch;`;

for (const file of FILES) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`Cannot read ${file}: ${e.message}`); continue; }

  // The JS code is embedded in JSON as a string — newlines are \n or \r\n
  // Try both exact matches and normalized
  let content = raw;

  // Try direct replacement first (content may have \r\n or \n)
  const oldNorm = OLD_FILTER.replace(/\n/g, '\\n').replace(/'/g, "\\'");
  const newNorm = NEW_FILTER.replace(/\n/g, '\\n').replace(/'/g, "\\'");

  const before = content;

  // The JSON stores the code with escaped newlines as \n in string
  // Try replacing the escaped version
  const oldEscaped = OLD_FILTER
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/'/g, "'");    // single quotes stay as-is in JSON

  const newEscaped = NEW_FILTER
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/'/g, "'");

  content = content.replace(oldEscaped, newEscaped);

  if (content === before) {
    // Try with \r\n
    const oldEscapedCRLF = OLD_FILTER
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\r\\n')
      .replace(/'/g, "'");
    const newEscapedCRLF = NEW_FILTER
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\r\\n')
      .replace(/'/g, "'");
    content = content.replace(oldEscapedCRLF, newEscapedCRLF);
  }

  if (content === before) {
    // Fallback: find the Filter Rows jsCode by keyword and replace the value
    content = content.replace(
      /("jsCode":\s*")(\/\/ Filter Rows v2[\s\S]*?)(",\s*\n\s*"mode")/,
      (match, pre, code, post) => {
        const newCode = NEW_FILTER
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/"/g, '\\"')
          .replace(/'/g, "'");
        return pre + newCode + post;
      }
    );
  }

  if (content === before) {
    console.warn(`  [${file}] WARNING: Filter Rows code not found — check manually`);
    continue;
  }

  // Validate JSON
  try {
    JSON.parse(content);
    console.log(`  [${file}] JSON valid ✓`);
  } catch (e) {
    console.error(`  [${file}] JSON INVALID: ${e.message} — aborting`);
    continue;
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [${file}] Written — ROWS_LIMIT=100 added\n`);
}

console.log('fix_v17.js done.');
