import {
  readState,
  readGuestState,
  removeItem,
  subscribe,
  getOwner,
  mergeStates,
  writeState,
} from "./store.js";
import { MODULES } from "../modules/index.js";
import { INSTRUMENTS } from "../instruments/catalog.js";
import { getCurriculum } from "../curriculum/data.js";
import { filterMappings } from "../curriculum/model.js";
import { getStudentPrefs } from "../curriculum/preferences.js";
import { loadAssignments, loadSubmissions } from "./classroomStore.js";
import { escapeHtml as esc } from "../lib/html.js";
import { t, tBoard, tClass, tSubject, languages, getLanguage, formatNumber } from "../i18n/config.js";

function computeGamification({ visitedCount, completeCount, quizzesMasteredCount, reportsCount }) {
  const xp = visitedCount * 15 + completeCount * 50 + quizzesMasteredCount * 100 + reportsCount * 75;
  const level = Math.floor(xp / 200) + 1;
  const levelXp = xp % 200;
  const ranks = [
    "Lab Apprentice",
    "Curious Explorer",
    "Junior Researcher",
    "Experiment Specialist",
    "STEM Innovator",
    "Quantum Scholar",
  ];
  const rank = ranks[Math.min(ranks.length - 1, level - 1)];

  const badges = [
    { id: "first-spark", icon: "⚡", title: "First Spark", desc: "Explore your first 3D lab", unlocked: visitedCount >= 1 },
    { id: "lab-explorer", icon: "🔭", title: "Lab Explorer", desc: "Explore 5+ STEM labs", unlocked: visitedCount >= 5 },
    { id: "quiz-master", icon: "🏆", title: "Quiz Master", desc: "Master a module quiz", unlocked: quizzesMasteredCount >= 1 },
    { id: "report-author", icon: "📄", title: "Report Author", desc: "Submit a 3D lab report", unlocked: reportsCount >= 1 },
    { id: "offline-scholar", icon: "📡", title: "Offline Ready", desc: "Learn anywhere without internet", unlocked: true },
  ];

  return { xp, level, levelXp, rank, badges };
}

export async function mount(root) {
  const data = await getCurriculum();
  const all = [...MODULES, ...INSTRUMENTS];
  const byId = new Map(all.map((i) => [i.id, i]));
  const chById = new Map(data.mappings.map((c) => [c.id, c]));

  const href = (id) =>
    chById.has(id)
      ? `#/chapter/${id}`
      : byId.has(id)
        ? INSTRUMENTS.some((i) => i.id === id)
          ? `#/instruments/${id}`
          : `#/${id}`
        : "#/community";

  const labelFor = (id) =>
    chById.get(id)?.chapter || byId.get(id)?.name || "Activity";

  function paint() {
    const s = readState();
    const prefs = getStudentPrefs();
    const entries = Object.entries(s.progress);
    const complete = entries.filter(([, e]) => e.completed);
    const saved = Object.entries(s.saved).filter(([, e]) => !e.deleted);
    const visited = entries.filter(([, e]) => e.visited);
    const quizzesMastered = entries.filter(
      ([, e]) => e.quizCount && e.quizBest === e.quizCount
    );

    const assignments = loadAssignments();
    const submissions = loadSubmissions();
    const gradedReports = submissions.filter((sub) => sub.status === "Graded");

    const gamification = computeGamification({
      visitedCount: visited.length,
      completeCount: complete.length,
      quizzesMasteredCount: quizzesMastered.length,
      reportsCount: submissions.length,
    });

    const myChapters = filterMappings(data.mappings, {
      board: prefs.board,
      grade: prefs.grade,
      subject: prefs.subject,
    });
    const completedChapters = myChapters.filter((c) => s.progress[c.id]?.completed).length;
    const myModuleIds = [...new Set(myChapters.flatMap((c) => c.modules || []))];
    const pendingModules = myModuleIds
      .filter((id) => !s.progress[id]?.completed)
      .map((id) => byId.get(id))
      .filter(Boolean);
    const nextChapter = myChapters.find((c) => !s.progress[c.id]?.completed) || myChapters[0];
    const bookmarks = (prefs.bookmarks || []).map((id) => chById.get(id)).filter(Boolean);

    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero student-hero-glow">
        <div class="student-hero-top">
          <div>
            <span class="eyebrow">${esc(t("dashboard.eyebrow"))}</span>
            <h1>${esc(t("dashboard.title"))}</h1>
            <p>${getOwner() === "guest" ? esc(t("dashboard.guestNote")) : esc(t("dashboard.cloudNote"))}</p>
          </div>
          <div class="xp-rank-card">
            <div class="xp-level-badge">Level ${gamification.level} · ${esc(gamification.rank)}</div>
            <div class="xp-total">${formatNumber(gamification.xp)} XP</div>
            <div class="xp-bar-track" aria-label="XP progress to next level">
              <div class="xp-bar-fill" style="width:${Math.round((gamification.levelXp / 200) * 100)}%"></div>
            </div>
            <small class="fact">${200 - gamification.levelXp} XP to Level ${gamification.level + 1}</small>
          </div>
        </div>
        <div class="dashboard-profile-pills">
          <span class="tag">${esc(t("dashboard.selectedBoard"))}: <strong>${esc(tBoard(prefs.board))}</strong></span>
          <span class="tag">${esc(t("dashboard.currentClass"))}: <strong>${esc(tClass(prefs.grade))}</strong></span>
          <span class="tag">${esc(t("dashboard.preferredLanguage"))}: <strong>${esc(languages[getLanguage()] || "English")}</strong></span>
          <span class="tag">${esc(t("curriculum.subject"))}: <strong>${esc(tSubject(prefs.subject))}</strong></span>
        </div>
      </section>

      <div class="learning-stats">
        <article><b>${formatNumber(visited.length)}</b><span>${esc(t("dashboard.explored"))}</span></article>
        <article><b>${formatNumber(complete.length)}</b><span>${esc(t("dashboard.completed"))}</span></article>
        <article><b>${formatNumber(quizzesMastered.length)}</b><span>${esc(t("dashboard.quizzesTaken"))}</span></article>
        <article><b>${formatNumber(saved.length)}</b><span>${esc(t("dashboard.savedViz"))}</span></article>
      </div>

      <section class="achievements-strip" aria-label="Student achievements">
        <h2>🏅 Achievement Badges</h2>
        <div class="badges-grid">
          ${gamification.badges
            .map(
              (b) => `
            <div class="achievement-badge ${b.unlocked ? "unlocked" : "locked"}">
              <span class="badge-emoji">${b.icon}</span>
              <div>
                <strong>${esc(b.title)}</strong>
                <span>${esc(b.desc)}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </section>

      <section>
        <h2>📚 Assigned by Your Teacher (${assignments.length})</h2>
        <div class="bench">
          ${
            assignments.length
              ? assignments
                  .slice(0, 4)
                  .map(
                    (a) => `
                  <article class="card assignment-student-card">
                    <span class="tag">Due ${esc(a.dueDate)} · Class ${esc(a.grade)}-${esc(a.section)}</span>
                    <h3>${esc(a.title)}</h3>
                    <p>${esc(a.instructions)}</p>
                    <div class="btn-row" style="margin-top:auto;">
                      <a class="btn btn-sm primary" href="#/${esc(a.moduleId)}">Start 3D Lab →</a>
                    </div>
                  </article>
                `
                  )
                  .join("")
              : `<p class="fact">No active class assignments yet.</p>`
          }
        </div>
      </section>

      ${
        gradedReports.length
          ? `
      <section>
        <h2>🎓 Graded Lab Reports & Teacher Feedback</h2>
        <div class="bench">
          ${gradedReports
            .slice(0, 4)
            .map(
              (r) => `
            <article class="card graded-report-card">
              <span class="report-status-pill done">Grade: ${esc(r.gradeScore || "A")}</span>
              <h3>${esc(r.moduleName)}</h3>
              <p class="fact"><b>${esc(r.studentName)}</b> · ${esc(r.submittedAt)}</p>
              <p>"${esc(r.teacherRemark || "Evaluated by teacher")}"</p>
            </article>
          `
            )
            .join("")}
        </div>
      </section>
      `
          : ""
      }

      <div class="dashboard-progress-box">
        <label>
          ${esc(t("dashboard.chapterProgress"))} (${esc(tClass(prefs.grade))} · ${esc(tSubject(prefs.subject))}: ${formatNumber(completedChapters)}/${formatNumber(myChapters.length)})
          <progress max="${Math.max(1, myChapters.length)}" value="${completedChapters}"></progress>
        </label>
        <div class="btn-row" style="margin-top:12px">
          ${nextChapter ? `<a class="btn primary" href="#/chapter/${esc(nextChapter.id)}">${esc(t("dashboard.recommendedNext"))}: ${esc(nextChapter.chapter)} →</a>` : ""}
          ${getOwner() !== "guest" ? `<button class="btn" id="import-guest">${esc(t("dashboard.copyGuest"))}</button>` : ""}
          <button class="btn" id="export-progress">${esc(t("dashboard.exportLearning"))}</button>
          <label class="btn">${esc(t("dashboard.importBackup"))}<input type="file" id="import-progress" accept="application/json" hidden></label>
        </div>
        <p id="backup-status" role="status"></p>
      </div>

      <section>
        <h2>${esc(t("dashboard.continueExploring"))}</h2>
        <div class="bench">${
          visited
            .sort((a, b) => b[1].visitedAt - a[1].visitedAt)
            .slice(0, 6)
            .map(
              ([id, e]) =>
                `<a class="card" href="${href(id)}"><h3>${esc(labelFor(id))}</h3><p>${e.completed ? esc(t("experiments.completed")) : `${esc(t("dashboard.continueExploring"))} →`}${e.quizCount ? ` · ${esc(t("experiments.quizScore"))}: ${formatNumber(e.quizBest)}/${formatNumber(e.quizCount)}` : ""}</p></a>`
            )
            .join("") || `<p class="fact">${esc(t("curriculum.noMapping"))}</p>`
        }</div>
      </section>

      <section>
        <h2>${esc(t("dashboard.bookmarkedLessons"))}</h2>
        <div class="bench">${
          bookmarks.length
            ? bookmarks
                .map(
                  (c) =>
                    `<a class="card" href="#/chapter/${esc(c.id)}"><span class="tag">${esc(tClass(c.grade))} · ${esc(tSubject(c.subject))}</span><h3>${esc(c.chapter)}</h3><p>${esc(c.topic)}</p></a>`
                )
                .join("")
            : `<p class="fact">${esc(t("curriculum.noMapping"))}</p>`
        }</div>
      </section>

      <section>
        <h2>${esc(t("dashboard.pendingExperiments"))}</h2>
        <div class="bench">${
          pendingModules.length
            ? pendingModules
                .slice(0, 6)
                .map(
                  (m) =>
                    `<a class="card" href="#/${esc(m.id)}"><span class="card-icon">${m.icon}</span><h3>${esc(m.name)}</h3><p>${esc(m.blurb)}</p></a>`
                )
                .join("")
            : `<p class="fact">${esc(t("experiments.completed"))}</p>`
        }</div>
      </section>

      <section>
        <h2>${esc(t("dashboard.savedViz"))}</h2>
        <div class="bench">${
          saved
            .map(
              ([id, e]) =>
                `<article class="card"><h3>${esc(e.name || e.expr || "Visualization")}</h3><p>${esc(e.mode || "surface")}</p><div class="btn-row"><a class="btn" href="#/formula/${id}">${esc(t("dashboard.open"))}</a><button class="btn" data-remove="${id}">${esc(t("dashboard.remove"))}</button></div></article>`
            )
            .join("") || `<p class="fact"><a href="#/formula">${esc(t("navigation.formula"))}</a></p>`
        }</div>
      </section>
    `;

    root.querySelector("#import-guest")?.addEventListener("click", () => {
      writeState(mergeStates(readState(), readGuestState()));
    });
    root
      .querySelectorAll("[data-remove]")
      .forEach((b) => (b.onclick = () => removeItem("saved", b.dataset.remove)));
    root.querySelector("#export-progress").onclick = () => {
      const blob = new Blob([JSON.stringify(readState(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "spark-learning.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    root.querySelector("#import-progress").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2000000) throw new Error("Backup must be under 2 MB.");
        const d = JSON.parse(await file.text());
        if (d.version !== 2 || typeof d.progress !== "object")
          throw new Error("Not a Spark learning backup.");
        writeState(mergeStates(readState(), d));
        root.querySelector("#backup-status").textContent = "Backup merged with your learning.";
      } catch (err) {
        root.querySelector("#backup-status").textContent = err.message;
      }
    };
  }

  paint();
  const unsub = subscribe(paint);
  document.addEventListener("spark-language", paint);
  addEventListener("spark-classroom-update", paint);
  return () => {
    unsub();
    document.removeEventListener("spark-language", paint);
    removeEventListener("spark-classroom-update", paint);
  };
}
