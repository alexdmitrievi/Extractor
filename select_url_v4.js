// Select URL v4 — Pure regex URL parsing (no URL constructor, works in all n8n sandboxes)
// ROOT CAUSE FIX: n8n Code node runs in vm.createContext({}) where 'URL' is undefined.
// new URL() inside fixUrl was silently catching ReferenceError -> returning '' -> no seeds found.
const inputItems = $input.all();

const URL_FIELD_PRIORITY = [
  'Веб-сайт', 'Веб-сайт 1', 'Веб-сайт 2', 'Веб-сайт 3',
  'Сайт', 'Сайт 1', 'Сайт 2', 'Сайт 3',
  'Website', 'Website 1', 'Website 2', 'Website 3',
  'Site', 'Site 1', 'Site 2', 'Site 3',
  'URL', 'Url', 'url', 'Домен', 'Domain', 'Главная страница', 'Homepage',
  'ВКонтакте', 'Вконтакте', 'VK', 'vk', 'VK URL',
  'Telegram 1', 'Telegram 2', 'Telegram 3', 'Telegram', 'telegram', 'Телеграм',
  '2GIS URL', '2ГИС',
];

const BLOCKED_SEED = /^(www\.)?(wa\.me|whatsapp\.com|api\.whatsapp\.com|chat\.whatsapp\.com|viber\.com|viber\.click|max\.ru|max\.me|youtu\.be|youtube\.com|twitter\.com|x\.com|tiktok\.com|pinterest\.com|threads\.net)$/i;
const VK_HOST = /^(www\.|m\.)?vk\.(com|ru)$/i;
const TG_HOST = /^(www\.)?(t\.me|telegram\.me|telegram\.org)$/i;
const SOCIAL_HOST = /^(www\.|m\.)?(vk\.com|vk\.ru|t\.me|telegram\.me|telegram\.org|facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|ok\.ru)$/i;

const DEEP_PATHS = [
  '/contacts', '/contact', '/kontakty',
  '/o-nas', '/o-kompanii', '/about', '/about-us', '/contact-us',
  '/info', '/feedback',
];

const MAX_CRAWL = 8;

// Get hostname from URL using regex (no URL constructor)
function getHost(url) {
  const m = String(url || '').match(/^https?:\/\/([^\/:?#\s]+)/i);
  if (!m) return '';
  return m[1].toLowerCase().replace(/^www\./, '');
}

// Get origin (scheme+host) from URL using regex
function getOrigin(url) {
  const m = String(url || '').match(/^(https?:\/\/[^\/:?#\s]+)/i);
  return m ? m[1] : '';
}

// Canonical deduplication key
function canonKey(url) {
  return String(url || '').trim().toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '') || String(url || '').toLowerCase();
}

// Normalize and validate URL — pure regex, no URL constructor
function fixUrl(raw) {
  const s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f]/g, '').trim();
  if (!s) return '';
  if (/^[+\d\s().\-]{5,}$/.test(s)) return '';
  if (/^[a-z0-9._%+\-]+@/i.test(s)) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : 'http://' + s.replace(/^\/+/, '');
  const hm = withScheme.match(/^https?:\/\/([^\/:?#\s@]+)/i);
  if (!hm) return '';
  const h = hm[1].toLowerCase();
  if (!h || !h.includes('.') || h.length < 4) return '';
  if (!/[a-z]/i.test(h)) return '';
  if (BLOCKED_SEED.test(h.replace(/^www\./, ''))) return '';
  return withScheme.replace(/#.*$/, '');
}

function extractFromValue(val) {
  const s = String(val == null ? '' : val).trim();
  if (!s) return [];
  const found = [];
  const seen = new Set();
  const add = (u) => {
    const fixed = fixUrl(u);
    if (fixed) { const k = canonKey(fixed); if (!seen.has(k)) { seen.add(k); found.push(fixed); } }
  };
  const direct = s.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  direct.forEach(add);
  const domains = s.match(/(?:[a-z0-9\-]+\.)+[a-z]{2,}(?:\/[^\s"'<>]*)?/gi) || [];
  domains.forEach(add);
  s.split(/[,;|\n]+/).forEach(part => add(part.trim()));
  return found;
}

const outputItems = [];

for (let sourceIndex = 0; sourceIndex < inputItems.length; sourceIndex++) {
  try {
    const item = inputItems[sourceIndex];
    let row;
    try {
      const serialized = JSON.stringify(item.json || {});
      row = JSON.parse(serialized);
    } catch {
      row = {};
    }

    if (sourceIndex === 0) {
      const allK = Object.keys(row);
      console.log('[SelectURL v4] batch=' + inputItems.length + ' keys=' + JSON.stringify(allK.slice(0, 20)));
      console.log('[SelectURL v4] Веб-сайт_1=' + JSON.stringify(row['\u0412\u0435\u0431-\u0441\u0430\u0439\u0442 1']) + ' 2GIS=' + JSON.stringify(row['2GIS URL']));
    }

    const rowNumber = row.row_number;
    const stableKey = (rowNumber !== null && rowNumber !== undefined && String(rowNumber).trim() !== '')
      ? String(rowNumber).trim()
      : String(sourceIndex);

    const seedCandidates = [];
    const seenSeeds = new Set();

    const addSeed = (url, tag) => {
      if (seedCandidates.length >= 3) return;
      const k = canonKey(url);
      if (!k || seenSeeds.has(k)) return;
      seenSeeds.add(k);
      seedCandidates.push({ url, tag });
    };

    // Pass 1: check known URL fields in priority order
    for (let fi = 0; fi < URL_FIELD_PRIORITY.length; fi++) {
      if (seedCandidates.length >= 3) break;
      const fieldName = URL_FIELD_PRIORITY[fi];
      const fieldVal = row[fieldName];
      if (fieldVal == null || fieldVal === '') continue;
      const urls = extractFromValue(String(fieldVal));
      for (let ui = 0; ui < urls.length && seedCandidates.length < 3; ui++) {
        addSeed(urls[ui], 'field:' + fieldName);
      }
    }

    // Pass 2: scan all fields for any URL-like content
    if (seedCandidates.length < 3) {
      const allKeys = Object.keys(row);
      for (let ki = 0; ki < allKeys.length && seedCandidates.length < 3; ki++) {
        const v = row[allKeys[ki]];
        if (v == null || v === '') continue;
        const sv = String(v);
        if (!/https?:\/\//i.test(sv) && !sv.includes('.')) continue;
        const urls = extractFromValue(sv);
        for (let ui = 0; ui < urls.length && seedCandidates.length < 3; ui++) {
          addSeed(urls[ui], 'scan:' + allKeys[ki]);
        }
      }
    }

    console.log('[SelectURL v4] row=' + stableKey + ' seeds=' + seedCandidates.length + (seedCandidates.length ? ' urls=' + seedCandidates.map(x => x.url).join(' | ') : ''));

    if (seedCandidates.length === 0) {
      outputItems.push({
        json: {
          ...row,
          targetUrl: '', targetHost: '', targetIsSocial: false,
          seed_url: '', seed_source: 'none', crawl_depth: 0, url_source: 'none',
          url_detected: false, source_row_index: sourceIndex,
          source_row_stable_key: stableKey, source_row_number: rowNumber ?? '',
          source_url_rank: 1, source_urls_count: 0,
        },
        pairedItem: { item: sourceIndex },
      });
      continue;
    }

    const crawlList = [];
    const seenCrawl = new Set();

    const addCrawl = (url, depth, source, seedUrl, seedTag) => {
      if (crawlList.length >= MAX_CRAWL) return;
      const k = canonKey(url);
      if (!k || seenCrawl.has(k)) return;
      seenCrawl.add(k);
      const host = getHost(url);
      crawlList.push({ url, depth, source, seedUrl, seedTag, targetHost: host, targetIsSocial: SOCIAL_HOST.test(host) });
    };

    for (let si = 0; si < seedCandidates.length; si++) {
      const seed = seedCandidates[si];
      addCrawl(seed.url, 0, seed.tag, seed.url, seed.tag);
      const host = getHost(seed.url);
      if (VK_HOST.test(host)) {
        const slugM = seed.url.match(/^https?:\/\/[^\/]+\/(.+?)\/?$/i);
        const slug = slugM ? slugM[1] : '';
        if (slug) addCrawl('https://m.vk.com/' + slug, 1, 'vk-mobile', seed.url, seed.tag);
      } else if (TG_HOST.test(host)) {
        const slugM = seed.url.match(/^https?:\/\/[^\/]+\/([^\/+][^\/]*)\/?$/i);
        const slug = slugM ? slugM[1].split('/')[0] : '';
        if (slug && slug !== 's' && !slug.startsWith('+') && !slug.startsWith('joinchat')) {
          addCrawl('https://t.me/s/' + slug, 1, 'tg-preview', seed.url, seed.tag);
        }
      } else {
        const origin = getOrigin(seed.url);
        if (origin) {
          for (let pi = 0; pi < DEEP_PATHS.length && crawlList.length < MAX_CRAWL; pi++) {
            const deep = fixUrl(origin + DEEP_PATHS[pi]);
            if (deep) addCrawl(deep, 1, 'deep:' + DEEP_PATHS[pi], seed.url, seed.tag);
          }
        }
      }
    }

    for (let ci = 0; ci < crawlList.length; ci++) {
      const entry = crawlList[ci];
      outputItems.push({
        json: {
          ...row,
          targetUrl: entry.url,
          targetHost: entry.targetHost,
          targetIsSocial: entry.targetIsSocial,
          seed_url: entry.seedUrl,
          seed_source: entry.seedTag,
          crawl_depth: entry.depth,
          url_source: entry.source,
          url_detected: true,
          source_row_index: sourceIndex,
          source_row_stable_key: stableKey,
          source_row_number: rowNumber ?? '',
          source_url_rank: ci + 1,
          source_urls_count: crawlList.length,
        },
        pairedItem: { item: sourceIndex },
      });
    }
  } catch (err) {
    const row = (inputItems[sourceIndex] && inputItems[sourceIndex].json) || {};
    const stableKey = (row.row_number != null && String(row.row_number).trim() !== '')
      ? String(row.row_number).trim() : String(sourceIndex);
    outputItems.push({
      json: {
        ...row,
        targetUrl: '', targetHost: '', targetIsSocial: false,
        seed_url: '', seed_source: 'select-url-error', crawl_depth: 0, url_source: 'error',
        url_detected: false, source_row_index: sourceIndex,
        source_row_stable_key: stableKey, source_row_number: (row.row_number ?? ''),
        source_url_rank: 1, source_urls_count: 0,
        select_url_error: String((err && err.message) || err),
      },
      pairedItem: { item: sourceIndex },
    });
  }
}

return outputItems;
