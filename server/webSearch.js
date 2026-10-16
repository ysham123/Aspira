function decodeHtmlEntities(value) {
  const named = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…',
  };
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    const normalized = code.toLowerCase();
    if (named[normalized]) return named[normalized];
    const numeric = normalized.startsWith('#x')
      ? Number.parseInt(normalized.slice(2), 16)
      : normalized.startsWith('#')
      ? Number.parseInt(normalized.slice(1), 10)
      : NaN;
    try {
      return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff
        ? String.fromCodePoint(numeric)
        : entity;
    } catch {
      return entity;
    }
  });
}

function plainTextFromHtml(value) {
  const withoutMarkup = String(value || '')
    .replace(/<(?:br\b|\/(?:p|div|li|h[1-6]|td|tr|blockquote)\b)[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(withoutMarkup)
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDuckDuckGoResults(html, limit = 5) {
  const source = String(html || '');
  const anchors = [...source.matchAll(
    /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])([^>]*)>([\s\S]*?)<\/a>/gi
  )];
  const results = [];
  const seenUrls = new Set();

  for (let index = 0; index < anchors.length && results.length < limit; index += 1) {
    const anchor = anchors[index];
    const href = anchor[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    const title = plainTextFromHtml(anchor[2]).slice(0, 240);
    if (!href || !title) continue;

    let resultUrl;
    try {
      const link = new URL(decodeHtmlEntities(href), 'https://duckduckgo.com');
      resultUrl = new URL(link.searchParams.get('uddg') || link.toString());
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(resultUrl.protocol) || resultUrl.username || resultUrl.password) continue;
    resultUrl.hash = '';
    if (seenUrls.has(resultUrl.toString())) continue;
    seenUrls.add(resultUrl.toString());

    const nextAnchorIndex = anchors[index + 1]?.index ?? source.length;
    const followingMarkup = source.slice(anchor.index + anchor[0].length, nextAnchorIndex);
    const snippetMarkup = followingMarkup.match(
      /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'])[^>]*>([\s\S]*?)<\/a>/i
    )?.[1] || followingMarkup.match(
      /<td\b[^>]*\bclass=["'][^"']*\bresult-snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i
    )?.[1] || '';

    results.push({
      title,
      url: resultUrl.toString(),
      snippet: plainTextFromHtml(snippetMarkup).slice(0, 400),
    });
  }
  return results;
}

export async function searchPublicWeb(query, signal, fetchImpl = fetch) {
  const normalizedQuery = String(query || '').trim().slice(0, 200);
  if (!normalizedQuery) throw new Error('A search query is required.');
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(normalizedQuery)}`;
  const response = await fetchImpl(searchUrl, {
    headers: { 'User-Agent': 'Aspira/1.0 (open-source personal agent workspace)' },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12_000)])
      : AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}.`);
  const html = await response.text();
  if (html.length > 1_500_000) throw new Error('Search provider returned an unexpectedly large page.');
  const results = extractDuckDuckGoResults(html);
  if (results.length === 0) throw new Error('Search provider returned no readable results.');
  return results;
}
