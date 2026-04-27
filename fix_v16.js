// fix_v16.js
// Changes:
//   1. Block VK, Telegram, 2GIS in BLOCKED_SEED (company sites only)
//   2. Remove special VK / Telegram crawl expansion (they're blocked anyway)
//   3. Restore MAX_CRAWL = 3
//   4. Update fixUrl to use new regex (handles m. prefix)

const fs = require('fs');

const FILES = [
  'Astra_Email_Extractor_v1_FINAL.json',
  'Astra_Email_Extractor_v2_FIXED.json',
];

// ─── Old strings to replace ──────────────────────────────────────────────────

const OLD_BLOCKED_SEED =
  `const BLOCKED_SEED = /^(www\\\\.)?(wa\\\\.me|whatsapp\\\\.com|api\\\\.whatsapp\\\\.com|chat\\\\.whatsapp\\\\.com|viber\\\\.com|viber\\\\.click|max\\\\.ru|max\\\\.me|youtu\\\\.be|youtube\\\\.com|twitter\\\\.com|x\\\\.com|tiktok\\\\.com|pinterest\\\\.com|threads\\\\.net)$/i;`;

const NEW_BLOCKED_SEED =
  `const BLOCKED_SEED = /^(www\\\\.|m\\\\.)?(vk\\\\.com|vk\\\\.ru|t\\\\.me|telegram\\\\.me|telegram\\\\.org|2gis\\\\.ru|2gis\\\\.com|dgis\\\\.ru|wa\\\\.me|whatsapp\\\\.com|api\\\\.whatsapp\\\\.com|chat\\\\.whatsapp\\\\.com|viber\\\\.com|viber\\\\.click|max\\\\.ru|max\\\\.me|youtu\\\\.be|youtube\\\\.com|twitter\\\\.com|x\\\\.com|tiktok\\\\.com|pinterest\\\\.com|threads\\\\.net)$/i;`;

// Old: BLOCKED_SEED check strips only www.
const OLD_BLOCKED_CHECK =
  `if (BLOCKED_SEED.test(h.replace(/^www\\\\./, ''))) return '';`;

const NEW_BLOCKED_CHECK =
  `if (BLOCKED_SEED.test(h)) return '';`;

// Old: MAX_CRAWL = 1
const OLD_MAX_CRAWL = `const MAX_CRAWL = 1;`;
const NEW_MAX_CRAWL = `const MAX_CRAWL = 3;`;

// Old: special VK + TG crawl expansion block
const OLD_VK_TG_BLOCK =
  `      if (VK_HOST.test(host)) {\\r\\n        const slugM = seed.url.match(/^\\\\.https?:\\\\.//[^\\\\.\/]+\\\\/(.+?)\\\\\\/?$/i);\\r\\n        const slug = slugM ? slugM[1] : '';\\r\\n        if (slug) addCrawl('https://m.vk.com/' + slug, 1, 'vk-mobile', seed.url, seed.tag);\\r\\n      } else if (TG_HOST.test(host)) {\\r\\n        const slugM = seed.url.match(/^\\\\.https?:\\\\.//[^\\\\.\/]+\\\\/([^\\\\.\/+][^\\\\.\/]*)\\\\\\/?$/i);\\r\\n        const slug = slugM ? slugM[1].split('/')[0] : '';\\r\\n        if (slug && slug !== 's' && !slug.startsWith('+') && !slug.startsWith('joinchat')) {\\r\\n          addCrawl('https://t.me/s/' + slug, 1, 'tg-preview', seed.url, seed.tag);\\r\\n        }\\r\\n      } else {`;

// ─── Apply fixes ─────────────────────────────────────────────────────────────

for (const file of FILES) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`Cannot read ${file}: ${e.message}`);
    continue;
  }

  let content = raw;

  // 1. Update BLOCKED_SEED regex (now includes VK, TG, 2GIS; handles m. prefix)
  // The JSON stores JS as a string with escaped characters
  // We need to work with the actual JSON string content

  let changed = 0;

  // Fix 1: MAX_CRAWL 1 → 3
  if (content.includes('"const MAX_CRAWL = 1;"') || content.includes('const MAX_CRAWL = 1;')) {
    // Could be escaped differently — search both ways
  }

  // Work directly on the raw JSON string content
  // The JS code is stored as a JSON string value, so backslashes are doubled

  // Fix MAX_CRAWL = 1 → 3
  const before1 = content;
  content = content.replace(/const MAX_CRAWL = 1;/g, 'const MAX_CRAWL = 3;');
  if (content !== before1) { console.log(`  [${file}] MAX_CRAWL: 1 → 3`); changed++; }
  else { console.warn(`  [${file}] WARNING: MAX_CRAWL = 1 not found`); }

  // Fix BLOCKED_SEED: add VK, TG, 2GIS; handle m. prefix
  // In JSON the regex /^(www\.)? becomes /^(www\\.)?  (one extra backslash per \)
  const oldBlockedRegex = /const BLOCKED_SEED = \/\^\(www\\\\\.[\s\S]*?\$\/i;/;
  const newBlockedRegexStr =
    'const BLOCKED_SEED = /^(www\\\\.|m\\\\.)?(vk\\\\.com|vk\\\\.ru|t\\\\.me|telegram\\\\.me|telegram\\\\.org|2gis\\\\.ru|2gis\\\\.com|dgis\\\\.ru|wa\\\\.me|whatsapp\\\\.com|api\\\\.whatsapp\\\\.com|chat\\\\.whatsapp\\\\.com|viber\\\\.com|viber\\\\.click|max\\\\.ru|max\\\\.me|youtu\\\\.be|youtube\\\\.com|twitter\\\\.com|x\\\\.com|tiktok\\\\.com|pinterest\\\\.com|threads\\\\.net)$/i;';

  const before2 = content;
  content = content.replace(oldBlockedRegex, newBlockedRegexStr);
  if (content !== before2) { console.log(`  [${file}] BLOCKED_SEED: added VK/TG/2GIS, m. prefix`); changed++; }
  else { console.warn(`  [${file}] WARNING: BLOCKED_SEED pattern not found via regex — trying literal`); }

  // Fix BLOCKED_SEED check: remove h.replace(/^www\./, '')  →  just h
  // In JSON string: h.replace(/^www\\./, '')  (with escaped dot)
  const before3 = content;
  content = content.replace(
    /if \(BLOCKED_SEED\.test\(h\.replace\(\/\^www\\\\\.\/,\s*''\)\)\) return '';/g,
    `if (BLOCKED_SEED.test(h)) return '';`
  );
  if (content !== before3) { console.log(`  [${file}] fixUrl check: removed h.replace → use h directly`); changed++; }
  else { console.warn(`  [${file}] WARNING: BLOCKED_SEED.test(h.replace...) pattern not found`); }

  // Fix: remove special VK/TG crawl expansion, collapse to just the "else" body
  // The block looks like:
  //   if (VK_HOST.test(host)) { ... } else if (TG_HOST.test(host)) { ... } else { <origin/DEEP crawl> }
  // We want to keep only the else body (deep crawl), removing the if/else-if branches
  const before4 = content;
  // Match the VK if-block through to the closing "} else {"
  const vkTgPattern = /if \(VK_HOST\.test\(host\)\) \{[\s\S]*?\} else if \(TG_HOST\.test\(host\)\) \{[\s\S]*?\} else \{/g;
  content = content.replace(vkTgPattern, '{');
  if (content !== before4) { console.log(`  [${file}] Removed VK/TG special crawl expansion`); changed++; }
  else { console.warn(`  [${file}] WARNING: VK/TG crawl block not found — may already be removed`); }

  if (changed === 0) {
    console.warn(`  [${file}] No changes made — check patterns`);
    continue;
  }

  // Validate JSON
  try {
    JSON.parse(content);
    console.log(`  [${file}] JSON valid ✓`);
  } catch (e) {
    console.error(`  [${file}] JSON INVALID after patch: ${e.message}`);
    console.error('  Aborting write for this file.');
    continue;
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [${file}] Written (${changed} changes)\n`);
}

console.log('fix_v16.js done.');
