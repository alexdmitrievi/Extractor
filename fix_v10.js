/**
 * fix_v10.js — two fixes:
 *
 * Fix 1: Fetch Website — remove retryOnFail (retries cause 2-minute hangs on blocked sites)
 *
 * Fix 2: Extract Emails — getDomainHints uses new URL() which throws ReferenceError in n8n sandbox.
 *         Replace with regex-based hostname extraction (same pattern used in Select URL node).
 */

const fs = require('fs');
const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

for (const filename of FILES) {
  if (!fs.existsSync(filename)) { console.log(`SKIP: ${filename}`); continue; }
  const wf = JSON.parse(fs.readFileSync(filename, 'utf8'));

  /* ─── Fix 1: Fetch Website — remove retryOnFail ───────────────────────── */
  const fetchNode = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!fetchNode) { console.error('Fetch Website not found'); process.exit(1); }

  fetchNode.retryOnFail = false;
  delete fetchNode.maxTries;
  delete fetchNode.waitBetweenTries;
  // Also shorten timeout to 25s — VK/2GIS don't return in 60s anyway
  if (fetchNode.parameters.options && fetchNode.parameters.options.timeout !== undefined) {
    fetchNode.parameters.options.timeout = 25000;
  }

  console.log(`${filename}: Fix 1 (Fetch Website: retryOnFail=false, timeout=25s) — OK`);

  /* ─── Fix 2: Extract Emails — replace new URL() with regex ─────────────── */
  const extractNode = wf.nodes.find(n => n.name === 'Extract Emails');
  if (!extractNode) { console.error('Extract Emails not found'); process.exit(1); }

  const oldCode = extractNode.parameters.jsCode;

  // Replace the getDomainHints function that uses new URL()
  const oldGetDomainHints = `const getDomainHints = (bucket) => {
  const hints = new Set();
  for (const url of bucket.fetchedUrls) {
    try {
      const host = new URL(url).hostname.replace(/^www\\./i, '').toLowerCase();
      if (/catalog\\.api\\.2gis\\./i.test(host)) continue;
      hints.add(host);
    } catch {}
  }
  const targetHost = String(bucket.mergedJson.targetHost || '').toLowerCase().replace(/^www\\./, '');
  if (targetHost) hints.add(targetHost);
  return Array.from(hints);
};`;

  const newGetDomainHints = `const getDomainHints = (bucket) => {
  const hints = new Set();
  for (const url of bucket.fetchedUrls) {
    // Regex-based hostname extraction (no URL constructor — not available in n8n sandbox)
    const m = String(url || '').match(/^https?:\\/\\/([^\\/:?#\\s]+)/i);
    if (!m) continue;
    const host = m[1].toLowerCase().replace(/^www\\./, '');
    if (!host || /catalog\\.api\\.2gis\\./i.test(host)) continue;
    hints.add(host);
  }
  const targetHost = String(bucket.mergedJson.targetHost || '').toLowerCase().replace(/^www\\./, '');
  if (targetHost) hints.add(targetHost);
  return Array.from(hints);
};`;

  if (!oldCode.includes('new URL(url)')) {
    console.log(`${filename}: Fix 2 — getDomainHints already uses regex, skip`);
  } else {
    const newCode = oldCode.replace(
      /const getDomainHints = \(bucket\) => \{[\s\S]*?\nconst stableKeys/,
      (match) => {
        return match.replace(oldGetDomainHints, newGetDomainHints);
      }
    );

    if (newCode === oldCode) {
      // Fallback: direct string replace
      const newCode2 = oldCode.split(oldGetDomainHints).join(newGetDomainHints);
      if (newCode2 === oldCode) {
        console.error(`${filename}: Fix 2 — FAILED to find getDomainHints pattern`);
        process.exit(1);
      }
      extractNode.parameters.jsCode = newCode2;
    } else {
      extractNode.parameters.jsCode = newCode;
    }
    console.log(`${filename}: Fix 2 (Extract Emails: getDomainHints → regex) — OK`);
  }

  fs.writeFileSync(filename, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`${filename}: saved ✓\n`);
}
