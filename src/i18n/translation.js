import { getLanguage, languages, t, bundledTranslation } from "./config.js";
import { RTL_LANGUAGES } from "./languages.js";
import { firebaseConfigured } from "../firebase.js";

const cache = new Map();
const LOCAL_CACHE_KEY = "spark.tr.cache.v2";

function readLocalCache() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalCache(key, value) {
  try {
    const data = readLocalCache();
    const keys = Object.keys(data);
    if (keys.length >= 500) delete data[keys[0]];
    data[key] = value;
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

export async function reviewId(lang, source) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(lang + "\n" + source)
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function reviewed(lang, source) {
  if (!firebaseConfigured) return null;
  try {
    const [{ db }, { doc, getDocFromServer }] = await Promise.all([
      import("../db.js"),
      import("firebase/firestore"),
    ]);
    const snap = await getDocFromServer(
      doc(db, "reviewedTranslations", await reviewId(lang, source))
    );
    const d = snap.data();
    return d?.source === source && d.language === lang ? d.target : null;
  } catch {
    return null;
  }
}

async function fetchBackendTranslation(source, targetLang) {
  const url = import.meta.env.VITE_TRANSLATION_API || "/api/translate";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: targetLang, text: source }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Backend translation unavailable");
  const body = await res.json();
  if (typeof body.translation !== "string" || !body.translation.trim()) {
    throw new Error("Invalid backend response");
  }
  return body.translation.trim();
}

async function fetchDirectGoogleFree(source, targetLang) {
  // Split long text into ~1500 char chunks on sentence/newline boundaries so requests never exceed URL limits
  const chunks = [];
  let remaining = source;
  while (remaining.length > 0) {
    if (remaining.length <= 1500) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", 1500);
    if (splitAt < 400) splitAt = remaining.lastIndexOf(". ", 1500);
    if (splitAt < 400) splitAt = 1500;
    chunks.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1);
  }

  const results = [];
  for (const part of chunks) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(part)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error("Google GTX HTTP " + res.status);
    const data = await res.json();
    const piece = Array.isArray(data?.[0])
      ? data[0].map((seg) => (Array.isArray(seg) ? seg[0] || "" : "")).join("")
      : "";
    if (!piece.trim()) throw new Error("Empty Google GTX piece");
    results.push(piece);
  }
  return results.join(" ").trim();
}

async function fetchDirectMyMemory(source, targetLang) {
  const email = import.meta.env.VITE_MYMEMORY_EMAIL || "";
  const de = email ? `&de=${encodeURIComponent(email)}` : "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    source.slice(0, 500)
  )}&langpair=${encodeURIComponent(`en|${targetLang}`)}${de}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("MyMemory HTTP " + res.status);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== "string" || !translated.trim()) {
    throw new Error("Empty MyMemory response");
  }
  return translated.trim();
}

export async function translateText(source, targetLang = getLanguage(), { allowNetwork = true } = {}) {
  source = (source || "").trim();
  if (!source || targetLang === "en") return { text: source, status: "original" };
  const key = `${targetLang}\n${source}`;

  let translated = await reviewed(targetLang, source);
  if (translated) return { text: translated, status: "reviewed" };

  translated = await bundledTranslation(targetLang, source);
  if (translated) return { text: translated, status: "bundled" };

  translated = cache.get(key) || readLocalCache()[key];
  if (translated) {
    cache.set(key, translated);
    return { text: translated, status: "cached" };
  }

  if (!allowNetwork) return { text: null, status: "unavailable" };

  // Waterfall: 1) Local/Backend /api/translate -> 2) Direct Keyless Google GTX -> 3) Direct Keyless MyMemory
  const providers = [
    () => fetchBackendTranslation(source, targetLang),
    () => fetchDirectGoogleFree(source, targetLang),
    () => fetchDirectMyMemory(source, targetLang),
  ];

  for (const run of providers) {
    try {
      const candidate = await run();
      if (typeof candidate === "string" && candidate.trim()) {
        translated = candidate.trim();
        break;
      }
    } catch {
      /* try next free keyless provider */
    }
  }

  if (!translated) {
    throw new Error("Unavailable");
  }

  if (cache.size >= 300) cache.delete(cache.keys().next().value);
  cache.set(key, translated);
  writeLocalCache(key, translated);
  return { text: translated, status: "machine" };
}

export function mountTranslation(root, source) {
  source = (source || "").trim();
  if (!root || !source) return;
  const label = document.createElement("label");
  const select = document.createElement("select");
  const button = document.createElement("button");
  const status = document.createElement("p");
  const output = document.createElement("p");
  label.dataset.i18n = "settings.language";
  label.textContent = t("settings.language");
  select.setAttribute("aria-label", t("settings.language"));
  Object.entries(languages)
    .filter(([k]) => k !== "en")
    .forEach(([k, v]) => select.add(new Option(v, k)));
  const activeLang = getLanguage();
  select.value = activeLang === "en" ? "hi" : activeLang;
  button.className = "btn";
  button.type = "button";
  button.dataset.i18n = "experiments.translate";
  button.textContent = t("experiments.translate");
  status.setAttribute("role", "status");
  output.className = "translated-text";
  root.replaceChildren(label, select, button, status, output);

  let request = 0;

  async function runTranslation(lang, allowNetwork) {
    const current = ++request;
    if (allowNetwork) {
      button.disabled = true;
      status.textContent = t("experiments.loading");
      output.textContent = "";
    }
    try {
      const res = await translateText(source, lang, { allowNetwork });
      if (current !== request) return;
      if (!res.text) return;
      output.lang = lang;
      output.dir = RTL_LANGUAGES.has(lang) ? "rtl" : "ltr";
      output.textContent = res.text;
      status.textContent =
        res.status === "reviewed"
          ? `${t("experiments.translation")} · Reviewed`
          : res.status === "bundled" || res.status === "cached"
            ? `${t("experiments.translation")} · Bundled`
            : t("experiments.review");
    } catch {
      if (current === request && allowNetwork) status.textContent = t("experiments.failed");
    } finally {
      if (current === request) button.disabled = false;
    }
  }

  // Auto-display translation immediately when non-English is active
  if (activeLang !== "en") {
    runTranslation(activeLang, true);
  }

  select.onchange = () => {
    request++;
    button.disabled = false;
    status.textContent = "";
    output.textContent = "";
    runTranslation(select.value, false);
  };
  button.onclick = () => runTranslation(select.value, true);
}
