// Fetch Website — Code Node v2 (runOnceForEachItem)
// IMPORTANT: $helpers is ONLY available in runOnceForEachItem mode, not runOnceForAllItems.
// This mode processes each item separately, preserving all original input fields.
const baseJson = JSON.parse(JSON.stringify($input.item.json || {}));
const url = String(baseJson.targetUrl || '').trim();

if (!url) {
  return { json: { ...baseJson, html: '', statusCode: 0 } };
}

try {
  const response = await $helpers.httpRequest({
    method: 'GET',
    url: url,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });

  const bodyRaw = response.body;
  const html = typeof bodyRaw === 'string' ? bodyRaw
    : (bodyRaw && typeof bodyRaw === 'object') ? JSON.stringify(bodyRaw)
    : String(bodyRaw || '');

  return {
    json: {
      ...baseJson,
      html,
      statusCode: Number(response.statusCode) || 200,
    },
  };
} catch (err) {
  return {
    json: {
      ...baseJson,
      html: '',
      statusCode: 0,
      fetch_error: String(err && err.message || err),
    },
  };
}
