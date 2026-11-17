import { MODULES, SUBJECTS, loadModule } from "../modules/index.js";
import { escapeHtml as esc } from "../lib/html.js";
import { t, tSubject, tClass, formatNumber } from "../i18n/config.js";
import { mountQuiz } from "../learn/quiz.js";
import { progress } from "../state.js";

export async function mount(root) {
  let activeSubject = "";
  let activeQuizModule = null;

  async function paint() {
    if (activeQuizModule) {
      const m = await loadModule(activeQuizModule.id);
      root.innerHTML = `
        <button class="back-btn" type="button" id="quiz-back">← ${esc(t("navigation.quizzes"))}</button>
        <article class="notebook">
          <span class="eyebrow">${esc(tSubject(activeQuizModule.subject))} · ${esc(tClass(activeQuizModule.grades?.[0] || 1))}–${formatNumber(activeQuizModule.grades?.[1] || 12)}</span>
          <h1>${activeQuizModule.icon} ${esc(activeQuizModule.name)} — ${esc(t("quiz.title"))}</h1>
          <div id="quiz-runner"></div>
        </article>
      `;
      root.querySelector("#quiz-back").onclick = () => {
        activeQuizModule = null;
        paint();
      };
      mountQuiz(root.querySelector("#quiz-runner"), m.id, m.quiz);
      return;
    }

    const list = MODULES.filter((m) => !activeSubject || m.subject === activeSubject);
    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${esc(t("navigation.quizzes"))}</span>
        <h1>${esc(t("quiz.allQuizzesTitle"))}</h1>
        <p>${esc(t("quiz.allQuizzesDesc"))}</p>
      </section>
      <div class="chip-row" role="group" aria-label="${esc(t("curriculum.subject"))}">
        <button class="chip" type="button" data-qsubj="" aria-pressed="${!activeSubject}">${esc(t("curriculum.all"))}</button>
        ${SUBJECTS.map(
          (s) =>
            `<button class="chip" type="button" data-qsubj="${esc(s)}" aria-pressed="${activeSubject === s}">${esc(tSubject(s))}</button>`
        ).join("")}
      </div>
      <div class="bench" style="margin-top:16px">
        ${list
          .map((m) => {
            const p = progress.for(m.id);
            const mastered = p.quizCount && p.quizBest === p.quizCount;
            const badge = mastered
              ? `<span class="badge is-mastered">${esc(t("experiments.mastered"))}</span>`
              : p.quizCount
                ? `<span class="badge is-score">${esc(t("experiments.quizScore"))} ${formatNumber(p.quizBest)}/${formatNumber(p.quizCount)}</span>`
                : "";
            return `
              <article class="card">
                <span class="card-icon">${m.icon}</span>
                <div class="card-meta-row">
                  <span class="tag">${esc(tSubject(m.subject))}</span>
                  ${badge}
                </div>
                <h3>${esc(m.name)}</h3>
                <p>${esc(m.blurb)}</p>
                <div class="btn-row">
                  <button class="btn primary" type="button" data-start-quiz="${esc(m.id)}">${esc(t("quiz.startQuiz"))} →</button>
                  <a class="btn" href="#/${esc(m.id)}">${esc(t("experiments.startExperiment"))}</a>
                </div>
              </article>`;
          })
          .join("")}
      </div>
    `;

    root.querySelectorAll("[data-qsubj]").forEach((btn) => {
      btn.onclick = () => {
        activeSubject = btn.dataset.qsubj;
        paint();
      };
    });
    root.querySelectorAll("[data-start-quiz]").forEach((btn) => {
      btn.onclick = () => {
        activeQuizModule = MODULES.find((m) => m.id === btn.dataset.startQuiz) || null;
        paint();
      };
    });
  }

  await paint();
  document.addEventListener("spark-language", paint);
  return () => document.removeEventListener("spark-language", paint);
}
