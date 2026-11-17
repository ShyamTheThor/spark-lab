import { getCurriculum, saveRecord } from "./data.js";
import {
  filterMappings,
  grades,
  subjects,
  subjectsForGrade,
  SCHOOL_STAGES,
  validMapping,
} from "./model.js";
import { getStudentPrefs, updateStudentPrefs } from "./preferences.js";
import { MODULES } from "../modules/index.js";
import { INSTRUMENTS } from "../instruments/catalog.js";
import { escapeHtml as e } from "../lib/html.js";
import { t, tSubject, tBoard, tClass, formatNumber, applyLanguage } from "../i18n/config.js";
import { isAdmin } from "../firebase.js";
import { mountTranslation } from "../i18n/translation.js";
import { progress } from "../state.js";

const tr = (key) => e(t("curriculum." + key));
const options = (items) =>
  items.map(([v, n]) => `<option value="${e(v)}">${e(n)}</option>`).join("");
const validSource = (s) => typeof s === "string" && s.startsWith("https://");

const links = (r) =>
  [
    ...r.modules
      .map((id) => MODULES.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => [m, `#/${m.id}`]),
    ...r.instruments
      .map((id) => INSTRUMENTS.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => [m, `#/instruments/${m.id}`]),
  ]
    .map(([m, url]) => `<a class="btn" href="${url}">${e(m.name)}</a>`)
    .join(" ");

function coverageBadge(r) {
  if (r.coverageStatus === "complete") {
    return `<span class="badge is-mastered">${tr("coverageComplete")}</span>`;
  }
  if (r.coverageStatus === "partial") {
    return `<span class="badge is-score">${tr("coveragePartial")}</span>`;
  }
  return `<span class="badge">${tr("coverageNoExp")}</span>`;
}

function card(r, boards) {
  const boardLabel = tBoard(r.board, boards.find((b) => b.id === r.board)?.name || r.board);
  const prog = progress.for(r.id);
  return `
    <article class="card curriculum-card">
      <div class="card-meta-row">
        <span class="tag">${e(boardLabel)} · ${e(tClass(r.grade))} · ${e(tSubject(r.subject))}</span>
        ${prog.completed ? `<span class="badge is-mastered">${e(t("experiments.completed"))}</span>` : ""}
      </div>
      <h3>${tr("chapterNum")} ${formatNumber(r.chapterNumber || r.chapterOrder || 1)}: ${e(r.chapter)}</h3>
      ${r.textbookPart ? `<p class="fact">${e(r.textbookTitle)} (${e(r.textbookPart)})</p>` : ""}
      <p>${e(r.topic)}</p>
      <p><strong>${tr("objective")}:</strong> ${e(r.objective)}</p>
      <p><strong>${tr("outcome")}:</strong> ${e(r.outcome)}</p>
      <p>${coverageBadge(r)}</p>
      <div class="btn-row">
        <a class="btn primary" href="#/chapter/${e(r.id)}">${e(t("home.viewChapter"))} →</a>
        ${links(r)}
      </div>
      <p class="fact">${e(r.edition)} ${
        validSource(r.source)
          ? `· <a href="${e(r.source)}" target="_blank" rel="noopener noreferrer">${tr("source")}</a>`
          : ""
      }</p>
      <div class="curriculum-translation"></div>
    </article>`;
}

const activeRows = ({ boards, mappings }) =>
  mappings.filter((r) => boards.some((b) => b.id === r.board && b.enabled) && r.enabled);

function wireTranslations(root, rows) {
  root
    .querySelectorAll(".curriculum-translation")
    .forEach((el, i) => mountTranslation(el, `${rows[i].objective}\n${rows[i].outcome}`));
}

export async function mount(root) {
  root.innerHTML = '<p data-i18n="experiments.loading"></p>';
  applyLanguage(root);
  const data = await getCurriculum();
  const prefs = getStudentPrefs();
  let filters = {
    board: prefs.board || "ncert",
    grade: prefs.grade ? String(prefs.grade) : "",
    subject: prefs.subject || "",
    chapter: "",
    topic: "",
  };
  const boards = data.boards.filter((b) => b.enabled);
  const upcoming = data.upcomingBoards || [];
  if (!boards.some((b) => b.id === filters.board)) filters.board = boards[0]?.id || "";

  function paint() {
    const rows = activeRows(data);
    const availableSubjects = filters.grade
      ? subjectsForGrade(Number(filters.grade))
      : subjects;
    if (filters.subject && !availableSubjects.includes(filters.subject)) {
      filters.subject = "";
    }

    const chapterList = [
      ...new Set(
        filterMappings(rows, {
          board: filters.board,
          grade: filters.grade,
          subject: filters.subject,
        }).map((r) => r.chapter)
      ),
    ];
    const topicList = [
      ...new Set(
        filterMappings(rows, {
          board: filters.board,
          grade: filters.grade,
          subject: filters.subject,
          chapter: filters.chapter,
        }).map((r) => r.topic)
      ),
    ];

    const gradeOptions = SCHOOL_STAGES.map(
      (st) =>
        `<optgroup label="${e(t(st.labelKey))}">${grades
          .filter((g) => g >= st.min && g <= st.max)
          .map((g) => `<option value="${g}">${e(tClass(g))}</option>`)
          .join("")}</optgroup>`
    ).join("");

    const results = filterMappings(rows, filters);

    root.innerHTML = `
      <a class="back-btn" href="#/">← ${e(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${e(t("curriculum.verified"))} · ${e(t("curriculum.academicYear"))} 2026-27</span>
        <h1>${e(t("navigation.curriculum"))}</h1>
        <p>${e(t("home.stepChaptersDesc"))}</p>
      </section>

      <div class="board-status-strip">
        ${boards
          .map(
            (b) =>
              `<button type="button" class="chip" data-pick-board="${e(b.id)}" aria-pressed="${filters.board === b.id}">
                ✓ ${e(tBoard(b.id, b.name))}
              </button>`
          )
          .join("")}
        ${upcoming
          .map(
            (b) =>
              `<span class="chip chip-muted" title="${tr("comingSoon")}">${e(tBoard(b.id, b.name))} · ${tr("comingSoon")}</span>`
          )
          .join("")}
      </div>

      <div class="curriculum-filters">
        <label>${tr("board")}
          <select data-filter="board">${options(boards.map((b) => [b.id, tBoard(b.id, b.name)]))}</select>
        </label>
        <label>${tr("grade")}
          <select data-filter="grade"><option value="">${tr("all")}</option>${gradeOptions}</select>
        </label>
        <label>${tr("subject")}
          <select data-filter="subject">${options([
            ["", tr("all")],
            ...availableSubjects.map((s) => [s, tSubject(s)]),
          ])}</select>
        </label>
        <label>${tr("chapter")}
          <select data-filter="chapter">${options([
            ["", tr("all")],
            ...chapterList.map((c) => [c, c]),
          ])}</select>
        </label>
        <label>${tr("topic")}
          <select data-filter="topic">${options([
            ["", tr("all")],
            ...topicList.map((tp) => [tp, tp]),
          ])}</select>
        </label>
        <button class="btn" type="button" id="reset-curr-filters">${tr("resetFilters")}</button>
      </div>

      <p class="fact" role="status">${formatNumber(results.length)} ${tr("chapter")}</p>
      <div class="curriculum-grid">${results.map((r) => card(r, boards)).join("") || `<p>${tr("noResults")}</p>`}</div>
    `;

    root.querySelectorAll("[data-pick-board]").forEach((btn) => {
      btn.onclick = () => {
        filters.board = btn.dataset.pickBoard;
        filters.chapter = "";
        filters.topic = "";
        updateStudentPrefs({ board: filters.board });
        paint();
      };
    });

    root.querySelectorAll("[data-filter]").forEach((select) => {
      const key = select.dataset.filter;
      select.value = filters[key];
      select.onchange = () => {
        filters[key] = select.value;
        if (["board", "grade", "subject"].includes(key)) {
          filters.chapter = "";
          updateStudentPrefs({
            board: filters.board,
            grade: filters.grade ? Number(filters.grade) : prefs.grade,
            subject: filters.subject || prefs.subject,
          });
        }
        if (key !== "topic") filters.topic = "";
        paint();
        root.querySelector(`[data-filter="${key}"]`)?.focus();
      };
    });

    root.querySelector("#reset-curr-filters").onclick = () => {
      filters = { board: boards[0]?.id || "ncert", grade: "", subject: "", chapter: "", topic: "" };
      paint();
    };

    wireTranslations(root, results);
  }

  paint();
  document.addEventListener("spark-language", paint);
  return () => document.removeEventListener("spark-language", paint);
}

export async function attachCurriculum(root, id, kind = "modules") {
  const data = await getCurriculum();
  if (!root.isConnected) return;
  const rows = activeRows(data).filter((r) => r[kind]?.includes(id));
  const paint = () => {
    root.innerHTML = `<h3>${e(t("navigation.curriculum"))}</h3>${
      rows.map((r) => card(r, data.boards)).join("") || `<p class="fact">${tr("noMapping")}</p>`
    }`;
    wireTranslations(root, rows);
  };
  paint();
  const listener = () => {
    if (root.isConnected) paint();
    else document.removeEventListener("spark-language", listener);
  };
  document.addEventListener("spark-language", listener);
}

export async function mountAdmin(root, _id, { user, signIn }) {
  if (!isAdmin(user)) {
    root.innerHTML = `<h1>${e(t("navigation.admin"))}</h1><p>${e(t("auth.adminRequired"))}</p><button class="btn">${e(t("auth.signIn"))}</button>`;
    root.querySelector("button").onclick = signIn;
    return;
  }
  const data = await getCurriculum();
  if (!data.cloud) {
    root.textContent = "Connect Firebase and Firestore before editing curriculum.";
    return;
  }
  const mappingList = () =>
    options([
      ["", "Create mapping"],
      ...data.mappings.map((r) => [r.id, `${r.id}: Ch ${r.chapterNumber || ""} ${r.chapter}`]),
    ]);
  root.innerHTML = `<h1>${e(t("navigation.admin"))}</h1><p class="fact">Add source-backed records only. Check the textbook edition, chapter number, and links before publishing.</p><form id="board-form" class="notebook curriculum-form"><h2>Boards</h2><label>Existing board<select name="select">${options([["", "New board"], ...data.boards.map((b) => [b.id, b.name])])}</select></label><label>Board ID<input name="id" required pattern="[a-z0-9-]{1,60}"></label><label>Name<input name="name" required maxlength="120"></label><label>State<input name="state" required maxlength="120"></label><label><input name="enabled" type="checkbox" checked> Enabled</label><button class="btn">Save board</button></form><form id="mapping-form" class="notebook curriculum-form"><h2>Mappings</h2><label>Existing mapping<select name="select">${mappingList()}</select></label><label>Board<select name="board">${options(data.boards.map((b) => [b.id, b.name]))}</select></label><label>Class<select name="grade">${options(grades.map((g) => [g, g]))}</select></label><label>Subject<select name="subject">${options(subjects.map((s) => [s, s]))}</select></label><label>Chapter Number<input name="chapterNumber" type="number" min="1" max="50" value="1"></label>${["chapter", "topic", "objective", "outcome", "edition", "source"].map((k) => `<label>${k}<input name="${k}" required maxlength="1000" ${k === "source" ? 'type="url"' : ""}></label>`).join("")}<label>Experiments<select name="modules" multiple size="6">${options(MODULES.map((m) => [m.id, m.name]))}</select></label><label>Instruments<select name="instruments" multiple size="6">${options(INSTRUMENTS.map((m) => [m.id, m.name]))}</select></label><label><input name="enabled" type="checkbox" checked> Enabled</label><button class="btn">Save mapping</button></form><form id="translation-form" class="notebook curriculum-form"><h2>Reviewed educational translation</h2><p>Paste the exact original English passage and the reviewed translation. Reviewed entries override machine translation.</p><label>Language<select name="language">${options(["hi", "kn", "ta", "te", "ml", "mr", "bn"].map((l) => [l, l]))}</select></label><label>English source<textarea name="source" maxlength="8000" required></textarea></label><label>Reviewed translation<textarea name="target" maxlength="12000" required></textarea></label><button class="btn">Save reviewed text</button></form><p role="status" id="admin-status"></p>`;
  const status = root.querySelector("#admin-status");
  const bf = root.querySelector("#board-form");
  const mf = root.querySelector("#mapping-form");
  function fill(form, r, fields) {
    form.reset();
    for (const k of fields) {
      const el = form.elements.namedItem(k);
      if (!el) continue;
      if (el.type === "checkbox") el.checked = r?.[k] ?? true;
      else if (el.multiple)
        Array.from(el.options).forEach((o) => (o.selected = (r?.[k] || []).includes(o.value)));
      else if (r && r[k] != null) el.value = r[k];
    }
  }
  bf.elements.namedItem("select").onchange = (ev) => {
    const id = ev.target.value;
    fill(
      bf,
      data.boards.find((b) => b.id === id),
      ["id", "name", "state", "enabled"]
    );
    bf.elements.namedItem("select").value = id;
  };
  mf.elements.namedItem("select").onchange = (ev) => {
    const id = ev.target.value;
    fill(
      mf,
      data.mappings.find((r) => r.id === id),
      [
        "board",
        "grade",
        "subject",
        "chapterNumber",
        "chapter",
        "topic",
        "objective",
        "outcome",
        "edition",
        "source",
        "modules",
        "instruments",
        "enabled",
      ]
    );
    mf.elements.namedItem("select").value = id;
  };
  const save = async (fn) => {
    status.textContent = t("experiments.loading");
    try {
      await fn();
      status.textContent = "Saved. Reopen this page to refresh the editor.";
    } catch (err) {
      status.textContent = err.message;
    }
  };
  bf.onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(bf);
    save(async () => {
      const r = {
        id: f.get("id"),
        name: f.get("name"),
        state: f.get("state"),
        enabled: f.has("enabled"),
      };
      await saveRecord("curriculumBoards", r);
    });
  };
  mf.onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(mf);
    save(async () => {
      const num = Number(f.get("chapterNumber")) || 1;
      const r = {
        id: f.get("select") || crypto.randomUUID(),
        board: f.get("board"),
        grade: Number(f.get("grade")),
        subject: f.get("subject"),
        chapterNumber: num,
        chapterOrder: num,
        enabled: f.has("enabled"),
        modules: f.getAll("modules"),
        instruments: f.getAll("instruments"),
      };
      for (const key of ["chapter", "topic", "objective", "outcome", "edition", "source"])
        r[key] = f.get(key).trim();
      if (
        !validMapping(
          r,
          data.boards,
          MODULES.map((m) => m.id),
          INSTRUMENTS.map((i) => i.id)
        )
      )
        throw new Error("Invalid mapping or missing source/content.");
      await saveRecord("curriculumMappings", r);
    });
  };
  root.querySelector("#translation-form").onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    save(async () => {
      const { reviewId } = await import("../i18n/translation.js");
      const source = f.get("source").trim(),
        language = f.get("language");
      await saveRecord("reviewedTranslations", {
        id: await reviewId(language, source),
        language,
        source,
        target: f.get("target").trim(),
      });
    });
  };
}
