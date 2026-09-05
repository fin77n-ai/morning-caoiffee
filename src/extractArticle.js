const crypto = require('node:crypto');
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const axios = require('axios');
const ipaddr = require('ipaddr.js');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const MAX_TEXT = 12000;
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const fingerprint = text => crypto.createHash('sha256').update(clean(text)).digest('hex');

function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

function validateUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) throw new Error('Unsupported article URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') ||
      (ipaddr.isValid(host) && !isPublicAddress(host))) throw new Error('Non-public article URL');
  return url;
}

// Validate the DNS answers used by the actual connection, including redirects.
function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (error, address, family) => {
    if (error) return callback(error);
    const addresses = Array.isArray(address) ? address.map(item => item.address) : [address];
    if (!addresses.length || addresses.some(value => !isPublicAddress(value))) {
      return callback(new Error('Non-public article address'));
    }
    callback(null, address, family);
  });
}

async function fetchHtml(value) {
  let url = validateUrl(value);
  const signal = AbortSignal.timeout(10000);
  const httpAgent = new http.Agent({ lookup: publicLookup });
  const httpsAgent = new https.Agent({ lookup: publicLookup });
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await axios.get(url.href, {
        httpAgent, httpsAgent, proxy: false, signal, timeout: 10000,
        maxRedirects: 0, maxContentLength: 1024 * 1024, responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Morning-cAoIffee/2.0 (article reader)', Accept: 'text/html' },
        validateStatus: status => status >= 200 && status < 400,
      });
      if (response.status >= 300) {
        if (!response.headers.location || redirects === 3) throw new Error('Article redirect limit');
        url = validateUrl(new URL(response.headers.location, url).href);
        continue;
      }
      if (!/text\/html|application\/xhtml\+xml/i.test(response.headers['content-type'] || '')) {
        throw new Error('Article is not HTML');
      }
      return { html: Buffer.from(response.data).toString('utf8'), url: url.href };
    }
  } finally {
    httpAgent.destroy();
    httpsAgent.destroy();
  }
}

function articleText(html, url) {
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  try {
    const article = new Readability(dom.window.document).parse();
    return clean(article?.textContent);
  } finally { dom.window.close(); }
}

async function extractArticle(item, { fetch = fetchHtml } = {}) {
  const fallback = clean(item.summary || item.description).slice(0, MAX_TEXT);
  const extracted = text => ({ text: text.length <= MAX_TEXT ? text : `${text.slice(0, 9000)} … ${text.slice(-2990)}`,
    status: 'full', hash: fingerprint(`${item.title || ''}\n${text}`) });
  try {
    validateUrl(item.url);
    if (item.content) {
      const text = articleText(`<article>${item.content.slice(0, 30000)}</article>`, item.url);
      if (text.length >= 600) return extracted(text);
    }
    const page = await fetch(item.url);
    const text = articleText(page.html, page.url || item.url);
    if (text.length >= 120) return extracted(text);
  } catch {
    // A blocked or unavailable page is weaker evidence, not a reason to invent it.
  }
  return { text: fallback, status: fallback ? 'summary' : 'unavailable', hash: fingerprint(fallback) };
}

module.exports = { extractArticle, articleText, fingerprint, validateUrl, isPublicAddress, fetchHtml };
