import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDuckDuckGoResults, searchPublicWeb } from './webSearch.js';

const fixture = `
  <div class="result results_links">
    <h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fguide%3Fa%3D1%26b%3D2&amp;rut=abc">Example <b>&amp;</b> Guide</a></h2>
    <a class="result__snippet">A <b>useful</b> guide for <b>people</b>.</a>
  </div>
  <div class="result results_links">
    <h2><a class="result__a" href="https://example.org/reference#section">Reference</a></h2>
    <a class="result__snippet">Reference entry with &#39;quoted&#39; text.</a>
  </div>
`;

test('extracts readable titles, snippets, and original result URLs', () => {
  const results = extractDuckDuckGoResults(fixture);
  assert.deepEqual(results, [
    {
      title: 'Example & Guide',
      url: 'https://example.com/guide?a=1&b=2',
      snippet: 'A useful guide for people.',
    },
    {
      title: 'Reference',
      url: 'https://example.org/reference',
      snippet: 'Reference entry with \'quoted\' text.',
    },
  ]);
});

test('drops unsafe, duplicate, and non-web result links', () => {
  const html = `
    <a class="result__a" href="javascript:alert(1)">Unsafe</a>
    <a class="result__a" href="mailto:user@example.com">Email</a>
    <a class="result__a" href="https://example.com/same">First</a>
    <a class="result__a" href="https://example.com/same#part">Duplicate</a>
  `;
  assert.deepEqual(extractDuckDuckGoResults(html), [
    { title: 'First', url: 'https://example.com/same', snippet: '' },
  ]);
});

test('queries the public HTML results page and returns parsed results', async () => {
  let calledUrl;
  let calledInit;
  const results = await searchPublicWeb('AI voice & agents', undefined, async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return new Response(fixture, { status: 200, headers: { 'Content-Type': 'text/html' } });
  });

  assert.equal(calledUrl, 'https://html.duckduckgo.com/html/?q=AI%20voice%20%26%20agents');
  assert.match(calledInit.headers['User-Agent'], /^Aspira\//);
  assert.equal(results.length, 2);
});

test('reports upstream and empty-result failures instead of substituting unrelated content', async () => {
  await assert.rejects(
    searchPublicWeb('test', undefined, async () => new Response('unavailable', { status: 503 })),
    /HTTP 503/
  );
  await assert.rejects(
    searchPublicWeb('test', undefined, async () => new Response('<html>challenge</html>', { status: 200 })),
    /no readable results/
  );
});
