// Fetch Website — Code Node v4 (runOnceForEachItem)
// n8n Code node sandbox provides: fetch(), JSON, Promise, console
// NOT available: AbortController, URL constructor, $helpers, setTimeout
const baseJson = JSON.parse(JSON.stringify($input.item.json || {}));
const url = String(baseJson.targetUrl || '').trim();

if (!url) {
  return { json: { ...baseJson, html: '', statusCode: 0 } };
}

try {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const html = await response.text();
  return {
    json: {
      ...baseJson,
      html,
      statusCode: response.status,
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
