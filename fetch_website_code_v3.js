// Fetch Website — Code Node v3 (runOnceForEachItem)
// Uses native fetch() — the ONLY way to make HTTP requests in n8n Code nodes.
// $helpers is NOT available in Code nodes (only in deprecated Function nodes).
const baseJson = JSON.parse(JSON.stringify($input.item.json || {}));
const url = String(baseJson.targetUrl || '').trim();

if (!url) {
  return { json: { ...baseJson, html: '', statusCode: 0 } };
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20000);

try {
  const response = await fetch(url, {
    method: 'GET',
    signal: controller.signal,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
    },
  });
  clearTimeout(timer);

  const html = await response.text();
  return {
    json: {
      ...baseJson,
      html,
      statusCode: response.status,
    },
  };
} catch (err) {
  clearTimeout(timer);
  return {
    json: {
      ...baseJson,
      html: '',
      statusCode: 0,
      fetch_error: String(err && err.message || err),
    },
  };
}
