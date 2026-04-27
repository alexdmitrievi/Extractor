/**
 * fix_reduce_batch.js
 *
 * ROOT CAUSE: n8n Cloud drops connection after ~60-90s of execution.
 * With batchSize=3 and MAX_CRAWL=8, each loop iteration = up to 24 HTTP requests
 * × 8s timeout worst case = up to 192s per batch → connection lost.
 *
 * FIX:
 *  1. Loop batchSize: 3 → 1 (only 1 company per iteration)
 *  2. MAX_CRAWL: 8 → 3 (homepage + /contacts + one deep page max)
 *     → max 3 HTTP requests per iteration × 8s = 24s worst case per batch
 */

const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

  // 1. Reduce batch size
  const loopNode = wf.nodes.find(n => n.name === 'Loop Over Items');
  if (loopNode) {
    loopNode.parameters.batchSize = 1;
    console.log(`${file}: Loop batchSize → 1`);
  }

  // 2. Reduce MAX_CRAWL in Select URL
  const selNode = wf.nodes.find(n => n.name === 'Select URL');
  if (selNode) {
    const key = selNode.parameters.jsCode ? 'jsCode' : 'code';
    selNode.parameters[key] = selNode.parameters[key].replace(
      /const MAX_CRAWL\s*=\s*\d+;/,
      'const MAX_CRAWL = 3;'
    );
    // Also reduce DEEP_PATHS to just 2 most useful pages
    selNode.parameters[key] = selNode.parameters[key].replace(
      /const DEEP_PATHS\s*=\s*\[[^\]]*\];/s,
      `const DEEP_PATHS = [
  '/contacts',
  '/kontakty',
];`
    );
    console.log(`${file}: MAX_CRAWL → 3, DEEP_PATHS → [/contacts, /kontakty]`);
  }

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`${file}: done\n`);
});
