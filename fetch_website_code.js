// Fetch Website — Code Node v1
// Replaces HTTP Request node to PRESERVE all input item fields.
// ROOT CAUSE: n8n HTTP Request node replaces item.json with response,
// losing source_row_stable_key, row_number, targetUrl, etc.
// This Code node does the same HTTP fetch but keeps all input fields.
const items = $input.all();
const output = [];

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  // Deep-copy input JSON — preserves row_number, stable_key, targetUrl, all sheet fields
  const baseJson = JSON.parse(JSON.stringify(item.json || {}));
  const url = String(baseJson.targetUrl || '').trim();

  if (!url) {
    output.push({
      json: { ...baseJson, html: '', statusCode: 0 },
      pairedItem: { item: i },
    });
    continue;
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

    output.push({
      json: { ...baseJson, html, statusCode: Number(response.statusCode) || 200 },
      pairedItem: { item: i },
    });
  } catch (err) {
    output.push({
      json: {
        ...baseJson,
        html: '',
        statusCode: 0,
        fetch_error: String(err && err.message || err),
      },
      pairedItem: { item: i },
    });
  }
}

return output;
