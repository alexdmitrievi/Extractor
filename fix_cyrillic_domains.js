/**
 * fix_cyrillic_domains.js — Fix Cyrillic (.рф) domain support
 *
 * Bug 1: fixUrl in Select URL drops pure-Cyrillic domains (кафе.рф)
 *        because !/[a-z]/i.test(h) rejects domains with no Latin letters.
 *
 * Bug 2: emailRegex has wrong alternation order.
 *        (?:[a-zа-яё]{2,24}|xn--[a-z0-9-]{2,58}) matches "xn" (2 chars)
 *        before trying xn-- → punycode TLDs like xn--p1ai (.рф) get truncated.
 *        Fix: put xn-- first in the alternation.
 */

const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

  // ── Fix 1: Select URL → fixUrl ───────────────────────────────────────────────
  const selNode = wf.nodes.find(n => n.name === 'Select URL');
  if (selNode) {
    const key = selNode.parameters.jsCode ? 'jsCode' : 'code';
    const before = selNode.parameters[key];
    const after = before.replace(
      /if \(!\s*\/\[a-z\]\/i\.test\(h\)\)/,
      'if (!/[a-zа-яё]/iu.test(h))'
    );
    if (before === after) {
      console.log(`${file}: WARN — fixUrl latin check not found`);
    } else {
      selNode.parameters[key] = after;
      console.log(`${file}: fixUrl — now accepts Cyrillic-only domains (.рф)`);
    }
  }

  // ── Fix 2: Extract Emails → emailRegex alternation order ────────────────────
  const extNode = wf.nodes.find(n => n.name === 'Extract Emails');
  if (extNode) {
    const key = extNode.parameters.jsCode ? 'jsCode' : 'code';
    const before = extNode.parameters[key];
    const after = before.replace(
      /\(\?:\[a-zа-яё\]\{2,24\}\|xn--\[a-z0-9-\]\{2,58\}\)/g,
      '(?:xn--[a-z0-9-]{2,58}|[a-zа-яё]{2,24})'
    );
    const count = (before.match(/\(\?:\[a-zа-яё\]\{2,24\}\|xn--\[a-z0-9-\]\{2,58\}\)/g) || []).length;
    if (before === after) {
      console.log(`${file}: WARN — emailRegex alternation not found`);
    } else {
      extNode.parameters[key] = after;
      console.log(`${file}: emailRegex — xn-- now has priority in ${count} regex(es)`);
    }
  }

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`${file}: done\n`);
});
