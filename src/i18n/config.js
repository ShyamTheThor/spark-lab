import en from "../locales/en.json";
import hi from "../locales/hi.json";
import kn from "../locales/kn.json";
import ta from "../locales/ta.json";
import te from "../locales/te.json";
import ml from "../locales/ml.json";
import mr from "../locales/mr.json";
import bn from "../locales/bn.json";
import { ALL_LANGUAGES, RTL_LANGUAGES } from "./languages.js";

export const languages = ALL_LANGUAGES;

const BUNDLED_LOCALES = {
  en,
  hi,
  kn,
  ta,
  te,
  ml,
  mr,
  bn,
};

const UI_DICT_CACHE_PREFIX = "spark.ui.dict.v1.";

let dictionary = en;
let language = "en";
let generation = 0;

export const getLanguage = () => language;
export const getDictionary = () => dictionary;

function readCachedDictionary(code) {
  try {
    const raw = localStorage.getItem(UI_DICT_CACHE_PREFIX + code);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedDictionary(code, dict) {
  try {
    localStorage.setItem(UI_DICT_CACHE_PREFIX + code, JSON.stringify(dict));
  } catch {
    /* storage unavailable */
  }
}

async function translateFreeChunk(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("GTX failed");
  const data = await res.json();
  if (!Array.isArray(data?.[0])) throw new Error("Invalid GTX payload");
  return data[0].map((seg) => (Array.isArray(seg) ? seg[0] || "" : "")).join("");
}

async function buildDynamicDictionary(code) {
  const cached = readCachedDictionary(code);
  if (cached && cached.navigation?.home) return cached;

  const built = structuredClone(en);
  // Collect all UI strings (excluding "labels" technical keys if desired, or translate all groups)
  const entries = [];
  for (const [group, items] of Object.entries(en)) {
    if (!items || typeof items !== "object") continue;
    for (const [k, val] of Object.entries(items)) {
      if (typeof val === "string" && val.trim()) {
        entries.push({ group, k, val });
      }
    }
  }

  // Batch strings in ~1200-char chunks separated by newline so the entire UI translates in 2-3 fast requests
  const SEP = "\n";
  let idx = 0;
  while (idx < entries.length) {
    const batch = [];
    let len = 0;
    while (idx < entries.length) {
      const clean = entries[idx].val.replace(/\n+/g, " ");
      if (batch.length > 0 && len + clean.length + 1 > 1200) break;
      batch.push({ ...entries[idx], clean });
      len += clean.length + 1;
      idx++;
    }
    try {
      const joined = batch.map((b) => b.clean).join(SEP);
      const translatedBlock = await translateFreeChunk(joined, code);
      const lines = translatedBlock.split(/\r?\n/);
      if (lines.length === batch.length) {
        batch.forEach((b, i) => {
          if (lines[i] && lines[i].trim()) {
            built[b.group][b.k] = lines[i].trim();
          }
        });
      } else {
        // Fallback: translate individually if line count shifted
        await Promise.all(
          batch.map(async (b) => {
            try {
              const single = await translateFreeChunk(b.clean, code);
              if (single && single.trim()) built[b.group][b.k] = single.trim();
            } catch {
              /* keep English fallback */
            }
          })
        );
      }
    } catch {
      /* keep English fallback for failed chunk */
    }
  }

  writeCachedDictionary(code, built);
  return built;
}

export async function bundledTranslation(code, source) {
  if (!Object.hasOwn(languages, code)) return null;
  const key = Object.keys(en.content || {}).find((k) => en.content[k] === source);
  if (!key) return null;
  const d = BUNDLED_LOCALES[code] || readCachedDictionary(code);
  return d?.content?.[key] || null;
}

export function t(key, vars) {
  const [group, name] = key.split(".");
  let str = dictionary[group]?.[name] || en[group]?.[name] || key;
  if (vars && typeof str === "string") {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export function formatNumber(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n ?? "");
  try {
    return new Intl.NumberFormat(language).format(n);
  } catch {
    return String(n);
  }
}

export function tSubject(subject) {
  if (!subject) return "";
  return dictionary.subjects?.[subject] || en.subjects?.[subject] || subject;
}

export function tBoard(boardId, fallback) {
  if (!boardId) return fallback || "";
  return dictionary.boards?.[boardId] || en.boards?.[boardId] || fallback || boardId;
}

export function tClass(grade) {
  return `${t("curriculum.classLabel")} ${formatNumber(Number(grade))}`;
}

export function tLabel(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (dictionary.labels?.[trimmed]) return dictionary.labels[trimmed];
  const lower = trimmed.toLowerCase();
  const key = Object.keys(dictionary.labels || {}).find((k) => k.toLowerCase() === lower);
  return key ? dictionary.labels[key] : text;
}

export async function setLanguage(code, { persist = true } = {}) {
  if (!Object.hasOwn(languages, code)) code = "en";
  const token = ++generation;

  let next = BUNDLED_LOCALES[code] || null;
  if (!next) {
    // Check localStorage cache first for instant switch, otherwise fetch via keyless free API
    next = readCachedDictionary(code);
    if (!next) {
      // Apply cached/English immediately while fetching dynamic UI translation
      dictionary = en;
      language = code;
      if (typeof document !== "undefined") {
        document.documentElement.lang = code;
        document.documentElement.dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
        applyLanguage();
        document.dispatchEvent(new CustomEvent("spark-language", { detail: { language: code } }));
      }
      next = await buildDynamicDictionary(code);
    }
  }

  if (token !== generation) return;
  dictionary = next || en;
  language = code;
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
    document.documentElement.dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
  }
  if (persist) {
    try {
      localStorage.setItem("spark.language", code);
    } catch {
      /* storage unavailable */
    }
    try {
      const { saveItem } = await import("../features/store.js");
      saveItem("preferences", "language", { value: code });
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    applyLanguage();
    const sel = document.getElementById("spark-language");
    if (sel && sel.value !== code) sel.value = code;
    document.dispatchEvent(new CustomEvent("spark-language", { detail: { language: code } }));
  }
}

export function applyLanguage(root = typeof document !== "undefined" ? document : null) {
  if (!root) return;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", el.title);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
}

export function mountLanguage() {
  const select = document.getElementById("spark-language");
  if (!select) return;
  select.replaceChildren(...Object.entries(languages).map(([k, v]) => new Option(v, k)));
  select.onchange = () => setLanguage(select.value);
  let saved = "en";
  try {
    saved = localStorage.getItem("spark.language") || "en";
  } catch {
    /* no storage */
  }
  setLanguage(saved, { persist: false }).then(() => {
    select.value = getLanguage();
  });
}
