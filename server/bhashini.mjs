// Multi-provider permanent free & keyless translation server (Google GTX + MyMemory + optional Bhashini/LibreTranslate).
// Never import this from src/.
const BHASHINI_CONFIG = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const BHASHINI_TARGETS = new Set(['hi', 'kn', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'as', 'ur']);

export const targets = [
  'hi','kn','ta','te','ml','mr','bn','gu','pa','or','as','ur','sa','ne','sd','ks','kok','mai','mni','doi','bho',
  'af','sq','am','ar','hy','az','eu','be','bs','bg','ca','ceb','ny','zh-CN','zh-TW','co','hr','cs','da','nl',
  'eo','et','tl','fi','fr','fy','gl','ka','de','el','ht','ha','haw','iw','he','hmn','hu','is','ig','id','ga',
  'it','ja','jw','kk','km','rw','ko','ku','ky','lo','la','lv','lt','lb','mk','mg','ms','mt','mi','mn','my',
  'no','ps','fa','pl','pt','ro','ru','sm','gd','sr','st','sn','si','sk','sl','so','es','su','sw','sv','tg',
  'tt','th','tr','tk','uk','ug','uz','vi','cy','xh','yi','yo','zu','ak','ay','bm','dv','ee','gn','ilo','kri',
  'ckb','ln','lg','lus','om','qu','nso','ti','ts'
];

const TARGET_SET = new Set(targets);

async function translateViaGoogleFree(text, targetLang, fetcher) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetcher(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Google free endpoint HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Malformed Google translation payload');
  const translated = data[0].map((part) => (Array.isArray(part) ? part[0] || '' : '')).join('').trim();
  if (!translated) throw new Error('Empty Google translation');
  return translated;
}

async function translateViaMyMemory(text, targetLang, fetcher, contactEmail = '') {
  const langPair = `en|${targetLang}`;
  const deParam = contactEmail ? `&de=${encodeURIComponent(contactEmail)}` : '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${encodeURIComponent(langPair)}${deParam}`;
  const res = await fetcher(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== 'string' || !translated.trim()) throw new Error('Empty MyMemory translation');
  return translated.trim();
}

export function createTranslator({ env = process.env, fetcher = fetch } = {}) {
  const cache = new Map();
  const services = new Map();
  const maxCache = 1000;
  const ttl = 24 * 60 * 60 * 1000;

  async function post(url, payload, headers = {}) {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    });
    if (!res.ok) throw new Error('Bhashini request failed');
    return res.json();
  }

  async function service(language) {
    const existing = services.get(language);
    if (existing && existing.until > Date.now()) return existing;
    const result = await post(
      BHASHINI_CONFIG,
      {
        pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: language } } }],
        pipelineRequestConfig: { pipelineId: env.BHASHINI_PIPELINE_ID },
      },
      { userID: env.BHASHINI_USER_ID, ulcaApiKey: env.BHASHINI_API_KEY }
    );
    const match = result.pipelineResponseConfig
      ?.find((r) => r.taskType === 'translation')
      ?.config?.find((c) => c.language?.sourceLanguage === 'en' && c.language?.targetLanguage === language);
    const endpoint = result.pipelineInferenceAPIEndPoint;
    if (!match?.serviceId || !endpoint?.callbackURL || !endpoint.inferenceApiKey?.name || !endpoint.inferenceApiKey?.value) {
      throw new Error('No supported translation service');
    }
    const url = new URL(endpoint.callbackURL);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Invalid compute endpoint');
    }
    const value = {
      url: url.href,
      header: endpoint.inferenceApiKey.name,
      key: endpoint.inferenceApiKey.value,
      id: match.serviceId,
      until: Date.now() + 10 * 60 * 1000,
    };
    services.set(language, value);
    return value;
  }

  return async function translate(text, language) {
    if (!TARGET_SET.has(language) || typeof text !== 'string' || !text.trim() || text.length > 8000) {
      throw Object.assign(new Error('Invalid text or language'), { status: 400 });
    }
    const cacheKey = language + '\n' + text;
    const old = cache.get(cacheKey);
    if (old && old.until > Date.now()) return old.value;

    let value = null;

    // 1. Optional Bhashini pipeline if credentials are explicitly configured for Indian languages
    if (env.BHASHINI_USER_ID && env.BHASHINI_API_KEY && env.BHASHINI_PIPELINE_ID && BHASHINI_TARGETS.has(language)) {
      try {
        const s = await service(language);
        const result = await post(
          s.url,
          {
            pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: language }, serviceId: s.id } }],
            inputData: { input: [{ source: text }] },
          },
          { [s.header]: s.key }
        );
        const target = result.pipelineResponse?.find((p) => p.taskType === 'translation')?.output?.[0]?.target;
        if (typeof target === 'string' && target.trim()) value = target.trim();
      } catch {
        /* fallback to keyless free engines */
      }
    }

    // 2. Permanent free & keyless Google GTX endpoint (supports all 135+ languages)
    if (!value) {
      try {
        value = await translateViaGoogleFree(text, language, fetcher);
      } catch {
        /* fallback to MyMemory */
      }
    }

    // 3. Secondary keyless fallback: MyMemory Free REST API
    if (!value) {
      try {
        value = await translateViaMyMemory(text, language, fetcher, env.MYMEMORY_EMAIL || '');
      } catch {
        /* all providers failed */
      }
    }

    if (typeof value !== 'string' || !value.trim()) {
      throw Object.assign(new Error('Translation service unavailable'), { status: 502 });
    }

    if (cache.size >= maxCache) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { value, until: Date.now() + ttl });
    return value;
  };
}

export function createTranslationHandler(options = {}) {
  const translate = createTranslator(options);
  const rates = new Map();
  let outstanding = 0;
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/translate') {
      if (next) return next();
      res.writeHead(404);
      return res.end();
    }
    const send = (code, data) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST') return send(405, { error: 'POST required' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
    const origin = req.headers.origin;
    const allowed = (options.env || process.env).SPARK_ALLOWED_ORIGIN;
    if (origin && origin !== allowed) {
      let host = '';
      try {
        host = new URL(origin).host;
      } catch {
        /* invalid */
      }
      if (!host || host !== req.headers.host) return send(403, { error: 'Origin not allowed' });
    }
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [key, r] of rates) if (now - r.start > 60000) rates.delete(key);
    const rate = rates.get(ip) || { start: now, count: 0 };
    if (rate.count >= 60 || outstanding >= 16 || (rates.size >= 10000 && !rates.has(ip))) {
      return send(429, { error: 'Try again later' });
    }
    rate.count++;
    rates.set(ip, rate);
    outstanding++;
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 50000) return send(413, { error: 'Text too large' });
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(400, { error: 'Invalid JSON' });
      }
      if (!body || typeof body !== 'object') return send(400, { error: 'Invalid JSON' });
      const translation = await translate(body.text, body.language);
      return send(200, { translation });
    } catch (err) {
      return send(err.status || 502, { error: err.status ? err.message : 'Translation service unavailable' });
    } finally {
      outstanding--;
    }
  };
}
