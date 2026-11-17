import { MODULES, SUBJECTS } from "../modules/index.js";
import { getCurriculum } from "../curriculum/data.js";
import { filterMappings, grades, subjectsForGrade } from "../curriculum/model.js";
import { getStudentPrefs, updateStudentPrefs } from "../curriculum/preferences.js";
import { escapeHtml as esc } from "../lib/html.js";
import { t, tSubject, tBoard, tClass, formatNumber } from "../i18n/config.js";
import { progress } from "../state.js";

function difficultyFor(m) {
  const [lo] = m.grades || [1, 12];
  if (lo <= 5) return { id: "basic", labelKey: "experiments.difficultyBasic" };
  if (lo <= 8) return { id: "intermediate", labelKey: "experiments.difficultyIntermediate" };
  return { id: "advanced", labelKey: "experiments.difficultyAdvanced" };
}

export async function mount(root) {
  root.innerHTML = `<p class="fact">${esc(t("experiments.loading"))}</p>`;
  const data = await getCurriculum();
  const prefs = getStudentPrefs();
  let mode = prefs.mode || "guided";
  let board = prefs.board || "ncert";
  let grade = String(prefs.grade || 10);
  let subject = "";
  let difficulty = "";

  function paint() {
    const allowedSubjects =
      mode === "guided" && grade ? subjectsForGrade(Number(grade)) : ["Environmental Studies", ...SUBJECTS];
    const mappings =
      mode === "guided"
        ? filterMappings(data.mappings, {
            board,
            grade: grade ? Number(grade) : "",
            subject,
          })
        : [];

    const moduleChapterMap = new Map();
    for (const r of mappings) {
      for (const mid of r.modules || []) {
        if (!moduleChapterMap.has(mid)) moduleChapterMap.set(mid, r);
      }
    }

    let items =
      mode === "guided"
        ? MODULES.filter((m) => moduleChapterMap.has(m.id))
        : MODULES.filter((m) => {
            if (!subject) return true;
            const norm = subject === "Mathematics" ? "Math" : subject;
            return m.subject === norm || m.subject === subject;
          });

    if (difficulty) {
      items = items.filter((m) => difficultyFor(m).id === difficulty);
    }

    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${esc(t("navigation.experiments"))} · ${formatNumber(MODULES.length)} 3D</span>
        <h1>${esc(t("navigation.experiments"))}</h1>
        <p>${esc(t("home.stepExperimentsDesc"))}</p>
        <div class="btn-row" role="group" aria-label="Learning mode">
          <button type="button" class="chip" data-lab-mode="guided" aria-pressed="${mode === "guided"}">
            🎯 ${esc(t("home.guidedMode"))}
          </button>
          <button type="button" class="chip" data-lab-mode="explore" aria-pressed="${mode === "explore"}">
            🧭 ${esc(t("home.exploreMode"))}
          </button>
        </div>
      </section>

      <div class="curriculum-filters">
        ${
          mode === "guided"
            ? `<label>${esc(t("curriculum.board"))}
                <select id="lab-board">${data.boards
                  .filter((b) => b.enabled)
                  .map(
                    (b) =>
                      `<option value="${esc(b.id)}" ${b.id === board ? "selected" : ""}>${esc(tBoard(b.id, b.name))}</option>`
                  )
                  .join("")}</select>
              </label>
              <label>${esc(t("curriculum.grade"))}
                <select id="lab-grade">
                  <option value="">${esc(t("curriculum.all"))}</option>
                  ${grades
                    .map(
                      (g) =>
                        `<option value="${g}" ${String(g) === grade ? "selected" : ""}>${esc(tClass(g))}</option>`
                    )
                    .join("")}
                </select>
              </label>`
            : ""
        }
        <label>${esc(t("curriculum.subject"))}
          <select id="lab-subject">
            <option value="">${esc(t("curriculum.all"))}</option>
            ${[...new Set(allowedSubjects)]
              .map(
                (s) =>
                  `<option value="${esc(s)}" ${s === subject ? "selected" : ""}>${esc(tSubject(s))}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>${esc(t("experiments.difficulty"))}
          <select id="lab-diff">
            <option value="">${esc(t("curriculum.all"))}</option>
            <option value="basic" ${difficulty === "basic" ? "selected" : ""}>${esc(t("experiments.difficultyBasic"))}</option>
            <option value="intermediate" ${difficulty === "intermediate" ? "selected" : ""}>${esc(t("experiments.difficultyIntermediate"))}</option>
            <option value="advanced" ${difficulty === "advanced" ? "selected" : ""}>${esc(t("experiments.difficultyAdvanced"))}</option>
          </select>
        </label>
      </div>

      <p class="fact" role="status">${formatNumber(items.length)} ${esc(t("navigation.experiments"))}</p>

      <div class="bench">
        ${
          items
            .map((m) => {
              const ch = moduleChapterMap.get(m.id);
              const diff = difficultyFor(m);
              const p = progress.for(m.id);
              const statusBadge = p.completed
                ? `<span class="badge is-mastered">${esc(t("experiments.completed"))}</span>`
                : p.visited
                  ? `<span class="badge is-visited">${esc(t("experiments.visited"))}</span>`
                  : "";
              return `
                <article class="card">
                  <span class="card-icon">${m.icon}</span>
                  <div class="card-meta-row">
                    <span class="tag">${esc(tSubject(m.subject))} · ${esc(tClass(m.grades?.[0] || 1))}–${formatNumber(m.grades?.[1] || 12)}</span>
                    <span class="tag">${esc(t(diff.labelKey))}</span>
                    ${statusBadge}
                  </div>
                  <h3>${esc(m.name)}</h3>
                  ${ch ? `<p class="fact">${esc(t("curriculum.chapterNum"))} ${formatNumber(ch.chapterNumber)}: ${esc(ch.chapter)}</p>` : ""}
                  <p>${esc(m.blurb)}</p>
                  <div class="btn-row">
                    <a class="btn primary" href="#/${esc(m.id)}">${esc(t("experiments.startExperiment"))} →</a>
                    ${ch ? `<a class="btn" href="#/chapter/${esc(ch.id)}">${esc(t("home.viewChapter"))}</a>` : ""}
                  </div>
                </article>`;
            })
            .join("") || `<p class="fact">${esc(t("experiments.noExperimentsYet"))}</p>`
        }
      </div>
    `;

    root.querySelectorAll("[data-lab-mode]").forEach((btn) => {
      btn.onclick = () => {
        mode = btn.dataset.labMode;
        updateStudentPrefs({ mode });
        paint();
      };
    });
    const bSel = root.querySelector("#lab-board");
    if (bSel) {
      bSel.onchange = () => {
        board = bSel.value;
        updateStudentPrefs({ board });
        paint();
      };
    }
    const gSel = root.querySelector("#lab-grade");
    if (gSel) {
      gSel.onchange = () => {
        grade = gSel.value;
        if (grade) updateStudentPrefs({ grade: Number(grade) });
        paint();
      };
    }
    root.querySelector("#lab-subject").onchange = (e) => {
      subject = e.target.value;
      paint();
    };
    root.querySelector("#lab-diff").onchange = (e) => {
      difficulty = e.target.value;
      paint();
    };
  }

  paint();
  document.addEventListener("spark-language", paint);
  return () => document.removeEventListener("spark-language", paint);
}
