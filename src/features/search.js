import { MODULES } from "../modules/index.js";
import { INSTRUMENTS } from "../instruments/catalog.js";
import { getCurriculum } from "../curriculum/data.js";
import { filterMappings } from "../curriculum/model.js";
import { getStudentPrefs } from "../curriculum/preferences.js";
import { escapeHtml as esc } from "../lib/html.js";
import { t, tSubject, tClass, formatNumber, getDictionary } from "../i18n/config.js";

const SYNONYMS = {
  voltage: ["circuit", "resistors", "ohm", "voltmeter", "battery"],
  current: ["circuit", "resistors", "ammeter", "electromagnet"],
  ohm: ["circuit", "resistors"],
  light: ["lens", "mirrors", "refraction", "prismdispersion", "lightscattering", "periscope", "humaneye"],
  optics: ["lens", "mirrors", "refraction", "prismdispersion", "optical"],
  plant: ["plantparts", "photosynthesis", "potometer"],
  acid: ["ph", "burette", "litmus"],
  base: ["ph"],
  heart: ["heart", "stethoscope", "sphygmomanometer"],
  cell: ["cell", "microscope"],
  triangle: ["pythagoras", "similarity"],
  sound: ["sound", "waves", "standing"],
  magnet: ["magnet", "compass", "electromagnet", "electromagneticinduction"],
  heat: ["heat", "thermometer", "calorimeter"],
  force: ["incline", "levers", "springbalance", "cradle"],
};

function expandTerms(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = new Set([q, ...q.split(/\s+/).filter(Boolean)]);
  const dict = getDictionary();
  // Reverse-map translated labels/subjects back to English keywords
  for (const group of ["subjects", "labels"]) {
    for (const [enKey, trVal] of Object.entries(dict[group] || {})) {
      if (trVal && trVal.toLowerCase().includes(q)) {
        terms.add(enKey.toLowerCase());
      }
    }
  }
  for (const [key, list] of Object.entries(SYNONYMS)) {
    if (q.includes(key)) list.forEach((x) => terms.add(x));
  }
  return [...terms];
}

export function searchLibrary(query, mappings, { curriculumOnly = false, prefs = getStudentPrefs() } = {}) {
  const terms = expandTerms(query);
  if (!terms.length) return { chapters: [], modules: [], instruments: [] };

  const matchText = (text) => {
    const low = (text || "").toLowerCase();
    return terms.some((term) => low.includes(term));
  };

  const scopedMappings = curriculumOnly
    ? filterMappings(mappings, { board: prefs.board, grade: prefs.grade, subject: prefs.subject })
    : mappings.filter((m) => m.board === (prefs.board || "ncert"));

  const chapters = scopedMappings.filter((c) =>
    matchText(`${c.chapter} ${c.topic} ${c.objective} ${c.subject} ${tSubject(c.subject)}`)
  );

  const allowedModIds = curriculumOnly ? new Set(scopedMappings.flatMap((c) => c.modules || [])) : null;
  const allowedInstIds = curriculumOnly ? new Set(scopedMappings.flatMap((c) => c.instruments || [])) : null;

  const modules = MODULES.filter(
    (m) =>
      (!allowedModIds || allowedModIds.has(m.id)) &&
      matchText(`${m.id} ${m.name} ${m.blurb} ${m.tag} ${m.subject} ${tSubject(m.subject)}`)
  );

  const instruments = INSTRUMENTS.filter(
    (i) =>
      (!allowedInstIds || allowedInstIds.has(i.id)) &&
      matchText(`${i.id} ${i.name} ${i.applications} ${i.principle} ${i.subject} ${tSubject(i.subject)}`)
  );

  return { chapters, modules, instruments };
}

export async function mount(root, initialQuery = "") {
  const data = await getCurriculum();
  const prefs = getStudentPrefs();
  let query = decodeURIComponent(initialQuery || "");
  let curriculumOnly = false;

  function paint() {
    const res = searchLibrary(query, data.mappings, { curriculumOnly, prefs });
    const total = res.chapters.length + res.modules.length + res.instruments.length;

    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${esc(t("search.searchTitle"))}</span>
        <h1>${esc(t("search.searchTitle"))}</h1>
        <div class="filters">
          <input id="smart-search-input" class="text-input search-input" type="search" value="${esc(query)}" placeholder="${esc(t("search.globalPlaceholder"))}" aria-label="${esc(t("search.searchTitle"))}">
          <label class="chip-check">
            <input type="checkbox" id="smart-search-scope" ${curriculumOnly ? "checked" : ""}>
            <span>${esc(t("search.filterByCurriculum"))} (${esc(tClass(prefs.grade))})</span>
          </label>
        </div>
        ${query ? `<p class="fact" role="status">${formatNumber(total)} ${esc(t("search.resultsCount"))}</p>` : ""}
      </section>

      ${
        !query
          ? `<p class="fact">${esc(t("search.placeholder"))}</p>`
          : total === 0
            ? `<p class="fact">${esc(t("search.noResults"))}</p>`
            : `
              ${
                res.chapters.length
                  ? `<section><h2>${esc(t("curriculum.chapter"))} (${formatNumber(res.chapters.length)})</h2><div class="bench">${res.chapters
                      .slice(0, 12)
                      .map(
                        (c) =>
                          `<a class="card" href="#/chapter/${esc(c.id)}"><span class="tag">${esc(tClass(c.grade))} · ${esc(tSubject(c.subject))}</span><h3>${esc(t("curriculum.chapterNum"))} ${formatNumber(c.chapterNumber)}: ${esc(c.chapter)}</h3><p>${esc(c.topic)}</p></a>`
                      )
                      .join("")}</div></section>`
                  : ""
              }
              ${
                res.modules.length
                  ? `<section><h2>${esc(t("navigation.experiments"))} (${formatNumber(res.modules.length)})</h2><div class="bench">${res.modules
                      .slice(0, 18)
                      .map(
                        (m) =>
                          `<a class="card" href="#/${esc(m.id)}"><span class="card-icon">${m.icon}</span><span class="tag">${esc(tSubject(m.subject))}</span><h3>${esc(m.name)}</h3><p>${esc(m.blurb)}</p></a>`
                      )
                      .join("")}</div></section>`
                  : ""
              }
              ${
                res.instruments.length
                  ? `<section><h2>${esc(t("navigation.instruments"))} (${formatNumber(res.instruments.length)})</h2><div class="bench">${res.instruments
                      .slice(0, 18)
                      .map(
                        (i) =>
                          `<a class="card" href="#/instruments/${esc(i.id)}"><span class="tag">${esc(tSubject(i.subject))}</span><h3>${esc(i.name)}</h3><p>${esc(i.applications)}</p></a>`
                      )
                      .join("")}</div></section>`
                  : ""
              }
            `
      }
    `;

    const inp = root.querySelector("#smart-search-input");
    inp.oninput = () => {
      query = inp.value;
      paint();
      const nextInp = root.querySelector("#smart-search-input");
      if (nextInp) {
        nextInp.focus();
        nextInp.setSelectionRange(query.length, query.length);
      }
    };
    root.querySelector("#smart-search-scope").onchange = (e) => {
      curriculumOnly = e.target.checked;
      paint();
    };
  }

  paint();
  document.addEventListener("spark-language", paint);
  return () => document.removeEventListener("spark-language", paint);
}
