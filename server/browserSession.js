import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import fs from 'node:fs';
import { chromium } from 'playwright';

const URL_DNS_CACHE_MS = 30_000;
const dnsCache = new Map();
const HIGH_IMPACT_CONTROL = /\b(?:send|submit|buy|purchase|pay|checkout|delete|remove|approve|confirm|order|transfer|post|publish|apply|book|reserve|unsubscribe|withdraw|deploy|share|invite|subscribe|join|vote|like|follow|comment|reply|react|accept|agree)\b|add\s+to\s+cart/i;
const SENSITIVE_INPUT = /\b(?:password|passcode|credit\s*card|card\s*number|security\s*code|cvv|social\s*security|bank\s*account|secret|recovery\s*code)\b/i;

export function isPublicAddress(address) {
  const clean = String(address || '').toLowerCase().split('%')[0];
  const version = isIP(clean);
  if (version === 4) {
    const octets = clean.split('.').map(Number);
    const value = (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
    const ranges = [
      [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
      [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
      [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
      [0xcb007100, 24], [0xe0000000, 4],
    ];
    return !ranges.some(([base, bits]) => (value >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (version === 6) {
    // Accept globally routable IPv6 only. This also excludes loopback,
    // link-local, unique-local, mapped IPv4, multicast and transition ranges.
    if (!/^[23][0-9a-f]{0,3}:/i.test(clean)) return false;
    return !/^(?:2001:0:|2001:10:|2001:20:|2001:db8:|2002:)/i.test(clean);
  }
  return false;
}

async function resolveHost(hostname) {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.addresses;
  const records = await lookup(hostname, { all: true, verbatim: true });
  const addresses = records.map((record) => record.address);
  dnsCache.set(hostname, { addresses, expiresAt: Date.now() + URL_DNS_CACHE_MS });
  return addresses;
}

export async function validatePublicBrowserUrl(rawUrl, resolver = resolveHost) {
  let url;
  const input = String(rawUrl || '').trim();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new Error('Aspira Browser only opens valid public HTTP or HTTPS addresses.');
  }
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error('Enter a valid public HTTP or HTTPS address.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Aspira Browser only opens public HTTP(S) pages without embedded credentials.');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Aspira Browser cannot open local or private network addresses.');
  }
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error('Aspira Browser cannot open local or private network addresses.');
    return url;
  }
  let addresses;
  try { addresses = await resolver(hostname); }
  catch { throw new Error('Aspira could not verify that this page uses a public network address.'); }
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error('Aspira Browser cannot open local or private network addresses.');
  }
  return url;
}

export async function validatePublicBrowserSocket(rawUrl, resolver = resolveHost) {
  let url;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Aspira Browser only permits public WebSocket addresses.'); }
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Aspira Browser only permits public WebSocket addresses.');
  }
  const httpUrl = `${url.protocol === 'wss:' ? 'https:' : 'http:'}//${url.host}/`;
  return validatePublicBrowserUrl(httpUrl, resolver);
}

export function safeDisplayUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

export function isHighImpactBrowserAction(name) {
  return HIGH_IMPACT_CONTROL.test(String(name || ''));
}

export class AspiraBrowserSession {
  constructor(profileDirectory, { headless = false } = {}) {
    this.profileDirectory = profileDirectory;
    this.headless = headless;
    this.context = null;
    this.launchPromise = null;
  }

  async ensureContext() {
    if (this.context) {
      try {
        this.context.pages();
        return this.context;
      } catch {
        this.context = null;
      }
    }
    if (this.launchPromise) return this.launchPromise;
    fs.mkdirSync(this.profileDirectory, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(this.profileDirectory, 0o700); } catch { /* Preserve the current session if the platform denies chmod. */ }
    this.launchPromise = chromium.launchPersistentContext(this.profileDirectory, {
      channel: 'chrome',
      headless: this.headless,
      viewport: null,
      acceptDownloads: false,
      serviceWorkers: 'block',
    }).then(async (context) => {
      await context.route('**/*', async (route) => {
        const request = route.request();
        try {
          await validatePublicBrowserUrl(request.url());
          await route.continue();
        } catch {
          await route.abort('blockedbyclient').catch(() => undefined);
        }
      });
      await context.routeWebSocket('**/*', async (socket) => {
        try {
          await validatePublicBrowserSocket(socket.url());
          socket.connectToServer();
        } catch {
          await socket.close({ code: 1008, reason: 'Aspira Browser blocks local and private network addresses.' }).catch(() => undefined);
        }
      });
      this.context = context;
      context.on('close', () => { if (this.context === context) this.context = null; });
      return context;
    }).catch((error) => {
      this.context = null;
      const detail = error instanceof Error ? error.message : '';
      throw new Error(/executable|browser.*install/i.test(detail)
        ? 'Aspira Browser needs Google Chrome installed. Install Chrome, then try again.'
        : 'Aspira could not open its separate Chrome profile. Close an existing Aspira Browser window and retry.');
    }).finally(() => { this.launchPromise = null; });
    return this.launchPromise;
  }

  async currentPage() {
    const context = await this.ensureContext();
    const pages = context.pages();
    return pages.at(-1) || await context.newPage();
  }

  async navigate(rawUrl) {
    const url = await validatePublicBrowserUrl(rawUrl);
    const page = await this.currentPage();
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    return this.readPage();
  }

  async readPage() {
    const page = await this.currentPage();
    await validatePublicBrowserUrl(page.url());
    const snapshot = await page.evaluate(() => {
      const visible = (element) => element instanceof HTMLElement && element.getClientRects().length > 0;
      const label = (element) => String(
        element.getAttribute('aria-label') || element.innerText || element.getAttribute('placeholder') || element.getAttribute('title') || ''
      ).replace(/\s+/g, ' ').trim().slice(0, 160);
      return {
        text: document.body?.innerText || '',
        links: Array.from(document.querySelectorAll('a[href]')).filter(visible).slice(0, 40).map((element) => ({
          text: label(element), href: element.href,
        })).filter((link) => link.text && /^https?:/i.test(link.href)),
        controls: Array.from(document.querySelectorAll('button,[role="button"],input:not([type="hidden"]),textarea,select,[role="textbox"]'))
          .filter(visible).slice(0, 40).map((element) => ({ role: element.getAttribute('role') || element.tagName.toLowerCase(), name: label(element) }))
          .filter((control) => control.name),
      };
    });
    return {
      title: (await page.title()).slice(0, 200),
      url: safeDisplayUrl(page.url()),
      text: String(snapshot.text).replace(/\n{3,}/g, '\n\n').trim().slice(0, 10_000),
      links: snapshot.links.map((link) => ({ text: link.text, url: safeDisplayUrl(link.href) })),
      controls: snapshot.controls,
    };
  }

  async click({ role = 'button', name }) {
    const roles = new Set(['button', 'link', 'tab', 'menuitem']);
    const cleanName = String(name || '').trim();
    if (!roles.has(role) || !cleanName || cleanName.length > 160) throw new Error('Choose a visible button, link, tab, or menu item by its exact name.');
    if (isHighImpactBrowserAction(cleanName)) throw new Error('This page action could send, publish, delete, buy, or confirm something. Review the page and click it yourself.');
    const page = await this.currentPage();
    await validatePublicBrowserUrl(page.url());
    const locator = page.getByRole(role, { name: cleanName, exact: true });
    const count = await locator.count();
    if (count !== 1) throw new Error(count ? `More than one ${role} is named “${cleanName}”. Use a more specific name.` : `No visible ${role} is named “${cleanName}” on this page.`);
    const insideForm = await locator.evaluate((element) => Boolean(element.closest('form') || element.form));
    if (insideForm) throw new Error('Aspira will not activate controls inside forms. Complete and submit forms yourself in the browser.');
    if (role === 'link') {
      const href = await locator.getAttribute('href');
      if (href) {
        let target;
        try { target = new URL(href, page.url()); }
        catch { throw new Error('Aspira Browser cannot follow that link.'); }
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Aspira Browser only follows public HTTP(S) links.');
        await validatePublicBrowserUrl(target.href);
      }
    }
    await locator.click({ timeout: 8000 });
    return this.readPage();
  }

  async fill({ label, value }) {
    const cleanLabel = String(label || '').trim();
    const cleanValue = String(value ?? '');
    if (!cleanLabel || cleanLabel.length > 160 || cleanValue.length > 4000) throw new Error('Provide a visible field label and text of up to 4,000 characters.');
    if (SENSITIVE_INPUT.test(cleanLabel)) throw new Error('Aspira will not fill password, payment, recovery, or other secret fields. Enter those directly in the browser.');
    const page = await this.currentPage();
    await validatePublicBrowserUrl(page.url());
    const locator = page.getByLabel(cleanLabel, { exact: true });
    const count = await locator.count();
    if (count !== 1) throw new Error(count ? `More than one field is labeled “${cleanLabel}”. Use a more specific label.` : `No field is labeled “${cleanLabel}” on this page.`);
    const inputType = await locator.evaluate((element) => `${element.getAttribute('type') || ''} ${element.getAttribute('autocomplete') || ''}`.toLowerCase());
    if (/password|cc-|credit-card|one-time-code|webauthn/.test(inputType)) throw new Error('Aspira will not fill password, payment, recovery, or other secret fields. Enter those directly in the browser.');
    await locator.fill(cleanValue, { timeout: 8000 });
    return this.readPage();
  }

  async close() {
    const context = this.context;
    this.context = null;
    if (context) await context.close();
    return { closed: Boolean(context) };
  }
}
