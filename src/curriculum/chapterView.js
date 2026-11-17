import { getCurriculum } from "./data.js";
import { filterMappings, stageForGrade } from "./model.js";
import { getStudentPrefs, updateStudentPrefs, toggleBookmark, isBookmarked } from "./preferences.js";
import { MODULES, getModule, loadModule } from "../modules/index.js";
import { INSTRUMENTS, findInstrument } from "../instruments/catalog.js";
import { escapeHtml as e } from "../lib/html.js";
import { t, tSubject, tBoard, tClass, formatNumber, getLanguage } from "../i18n/config.js";
import { mountTranslation } from "../i18n/translation.js";
import { mountAudioControls } from "../i18n/speech.js";
import { mountQuiz } from "../learn/quiz.js";
import { progress } from "../state.js";

function ageAdaptedIntro(ch) {
  const stage = stageForGrade(ch.grade)?.id || "secondary";
  if (stage === "primary") {
    return `In this chapter (${ch.chapter}), you will explore ${ch.topic.toLowerCase()} through simple, hands-on observation and fun everyday activities.`;
  }
  if (stage === "middle") {
    return `${ch.chapter} introduces ${ch.topic.toLowerCase()}. You will observe how scientific ideas work in daily life and test them with interactive 3D models.`;
  }
  if (stage === "secondary") {
    return `This chapter covers ${ch.topic.toLowerCase()} as prescribed in ${ch.edition}. Use the interactive 3D simulation and instruments below to verify principles quantitatively.`;
  }
  return `Senior secondary study of ${ch.chapter} (${ch.topic}). Analyze the underlying mathematical models, experimental parameters, and physical/chemical/biological laws.`;
}

function ageAdaptedExamples(ch) {
  const stage = stageForGrade(ch.grade)?.id || "secondary";
  const subj = ch.subject;
  if (stage === "primary") {
    return `Look around your home and school for examples of ${ch.topic.toLowerCase()} — with an adult's supervision, observe shapes, clocks, water, and plants safely.`;
  }
  if (subj === "Mathematics") {
    return `Everyday applications of ${ch.chapter}: measuring objects, reading patterns, calculating quantities, and solving real-world geometry or data problems.`;
  }
  if (subj === "Biology" || subj === "Environmental Studies") {
    return `Observe living organisms, healthy habits, and natural ecosystems around you to connect ${ch.chapter} with real life.`;
  }
  return `Applications of ${ch.chapter} appear in household appliances, transportation, medical tools, and modern technology.`;
}

function buildProcedureSteps(ch, modNames) {
  if (!modNames.length) {
    return [
      `Read the learning objective and basic concepts for ${ch.chapter}.`,
      `Review the real-life examples and important definitions.`,
      `Note your observations and complete the chapter summary.`,
    ];
  }
  return [
    `Open the interactive 3D experiment (${modNames.join(", ")}) below or in the Virtual Science Lab.`,
    `Adjust one control/slider at a time while keeping other parameters constant.`,
    `Observe how the 3D model, measurements, and labels respond in real time.`,
    `Record your observations and verify them against the chapter formulas and explanation.`,
  ];
}

export async function mountChapter(root, chapterId) {
  root.innerHTML = `<p class="fact">${e(t("experiments.loading"))}</p>`;
  const data = await getCurriculum();
  const ch = data.mappings.find((m) => m.id === chapterId);
  if (!ch) {
    root.innerHTML = `<a class="back-btn" href="#/curriculum">← ${e(t("chapterView.backToCurriculum"))}</a><p class="fact">${e(t("curriculum.noResults"))}</p>`;
    return () => {};
  }

  updateStudentPrefs({
    board: ch.board,
    grade: ch.grade,
    subject: ch.subject,
    lastChapterId: ch.id,
  });
  progress.markVisited(ch.id);

  // Sibling chapters in exact textbook order for Prev / Next buttons
  const siblings = filterMappings(data.mappings, {
    board: ch.board,
    grade: ch.grade,
    subject: ch.subject,
  });
  const idx = siblings.findIndex((s) => s.id === ch.id);
  const prevCh = idx > 0 ? siblings[idx - 1] : null;
  const nextCh = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const mods = (ch.modules || []).map((id) => getModule(id)).filter(Boolean);
  const insts = (ch.instruments || []).map((id) => findInstrument(id)).filter(Boolean);

  // Load first module quiz/lesson details if available (safe async)
  let primaryMod = null;
  if (mods[0]) {
    try {
      primaryMod = await loadModule(mods[0].id);
    } catch {
      primaryMod = null;
    }
  }

  let audioCleanup = null;

  function paint() {
    audioCleanup?.();
    const bookmarked = isBookmarked(ch.id);
    const prog = progress.for(ch.id);
    const introText = ageAdaptedIntro(ch);
    const examplesText = ageAdaptedExamples(ch);
    const steps = buildProcedureSteps(
      ch,
      mods.map((m) => m.name)
    );

    const modCards = mods
      .map(
        (m) => `
      <a class="card" href="#/${e(m.id)}">
        <span class="card-icon">${m.icon}</span>
        <span class="tag">${e(tSubject(m.subject))} · ${e(t("experiments.interactive3d") || "3D")}</span>
        <h3>${e(m.name)}</h3>
        <p>${e(m.blurb)}</p>
        <span class="btn primary" style="margin-top:auto">${e(t("experiments.startExperiment"))} →</span>
      </a>`
      )
      .join("");

    const instCards = insts
      .map(
        (inst) => `
      <a class="card instrument-card" href="#/instruments/${e(inst.id)}">
        <span class="tag">${e(tSubject(inst.subject))} · ${e(t("instruments.interactive3d"))}</span>
        <h3>${e(inst.name)}</h3>
        <p>${e(inst.applications)}</p>
      </a>`
      )
      .join("");

    root.innerHTML = `
      <div class="chapter-topbar">
        <a class="back-btn" href="#/curriculum">← ${e(t("chapterView.backToCurriculum"))}</a>
        <div class="btn-row">
          <button class="btn" type="button" id="bookmark-chapter" aria-pressed="${bookmarked}">
            ${bookmarked ? `★ ${e(t("chapterView.bookmarked"))}` : `☆ ${e(t("chapterView.bookmark"))}`}
          </button>
        </div>
      </div>

      <article class="notebook chapter-page">
        <!-- 1. Chapter number and title -->
        <header class="chapter-header">
          <span class="eyebrow">
            ${e(tBoard(ch.board))} · ${e(tClass(ch.grade))} · ${e(tSubject(ch.subject))}
            ${ch.textbookPart ? ` · ${e(ch.textbookPart)}` : ""}
          </span>
          <h1>${e(t("curriculum.chapterNum"))} ${formatNumber(ch.chapterNumber)}: ${e(ch.chapter)}</h1>
          <p class="fact">${e(ch.textbookTitle || ch.edition)} · ${e(t("curriculum.academicYear"))}: ${e(ch.academicYear || "2026-27")}
            · <a href="${e(ch.source)}" target="_blank" rel="noopener noreferrer">${e(t("curriculum.source"))}</a>
          </p>
          <div id="chapter-audio"></div>
        </header>

        <!-- 2. Introduction -->
        <section class="chapter-section notebook-block" id="sec-intro">
          <h2>2. ${e(t("chapterView.intro"))}</h2>
          <p>${e(introText)}</p>
        </section>

        <!-- 3. What you will learn -->
        <section class="chapter-section notebook-block" id="sec-learn">
          <h2>3. ${e(t("chapterView.whatYouLearn"))}</h2>
          <p><strong>${e(t("curriculum.objective"))}:</strong> ${e(ch.objective)}</p>
          <p><strong>${e(t("curriculum.outcome"))}:</strong> ${e(ch.outcome)}</p>
          <div id="chapter-objective-translation"></div>
        </section>

        <!-- 4. Basic concepts -->
        <section class="chapter-section notebook-block" id="sec-concepts">
          <h2>4. ${e(t("chapterView.basicConcepts"))}</h2>
          <p>${e(ch.topic)}</p>
        </section>

        <!-- 5. Important definitions -->
        <section class="chapter-section notebook-block" id="sec-defs">
          <h2>5. ${e(t("chapterView.importantDefs"))}</h2>
          <p>${e(ch.objective)}</p>
          ${primaryMod?.lesson ? `<div class="lesson-body">${primaryMod.lesson}</div>` : ""}
        </section>

        <!-- 6. Real-life examples -->
        <section class="chapter-section notebook-block" id="sec-examples">
          <h2>6. ${e(t("chapterView.realLifeExamples"))}</h2>
          <p>${e(examplesText)}</p>
        </section>

        <!-- 7. Interactive 3D experiment -->
        <section class="chapter-section notebook-block" id="sec-experiment">
          <h2>7. ${e(t("chapterView.experiment3d"))}</h2>
          ${
            mods.length
              ? `<div class="bench">${modCards}</div>`
              : `<p class="fact status-pill">${e(t("chapterView.noExperimentNote"))}</p>`
          }
        </section>

        <!-- 8. Scientific instruments -->
        <section class="chapter-section notebook-block" id="sec-instruments">
          <h2>8. ${e(t("chapterView.instrumentsUsed"))}</h2>
          ${
            insts.length
              ? `<div class="bench">${instCards}</div>`
              : `<p class="fact">${e(t("curriculum.noMapping"))}</p>`
          }
        </section>

        <!-- 9. Step-by-step virtual experiment procedure -->
        <section class="chapter-section notebook-block" id="sec-procedure">
          <h2>9. ${e(t("chapterView.procedure"))}</h2>
          <ol>${steps.map((s) => `<li>${e(s)}</li>`).join("")}</ol>
        </section>

        <!-- 10. Observations -->
        <section class="chapter-section notebook-block" id="sec-observations">
          <h2>10. ${e(t("chapterView.observations"))}</h2>
          <p>${e(ch.outcome)}</p>
        </section>

        <!-- 11. Important formulas -->
        <section class="chapter-section notebook-block" id="sec-formulas">
          <h2>11. ${e(t("chapterView.importantFormulas"))}</h2>
          <p>${
            ch.subject === "Mathematics" || ch.subject === "Physics" || ch.subject === "Science"
              ? `<a class="btn" href="#/formula">${e(t("navigation.formula"))} →</a>`
              : e(ch.topic)
          }</p>
        </section>

        <!-- 12. Results and explanation -->
        <section class="chapter-section notebook-block" id="sec-results">
          <h2>12. ${e(t("chapterView.resultsExplanation"))}</h2>
          <p>${e(ch.outcome)}</p>
        </section>

        <!-- 13. Chapter summary -->
        <section class="chapter-section notebook-block" id="sec-summary">
          <h2>13. ${e(t("chapterView.summary"))}</h2>
          <p>${e(ch.chapter)} — ${e(ch.topic)}. ${e(ch.outcome)}</p>
        </section>

        <!-- 14. Practice quiz -->
        <section class="chapter-section notebook-block" id="sec-quiz">
          <h2>14. ${e(t("chapterView.practiceQuiz"))}</h2>
          <div id="chapter-quiz"></div>
        </section>

        <!-- 15. Learning progress -->
        <section class="chapter-section notebook-block" id="sec-progress">
          <h2>15. ${e(t("chapterView.progressLabel"))}</h2>
          <div class="btn-row">
            <button class="btn primary" type="button" id="complete-chapter">
              ${prog.completed ? e(t("experiments.completed")) : e(t("experiments.complete"))}
            </button>
          </div>
        </section>

        <!-- 16. Previous and next chapter buttons -->
        <nav class="chapter-pager" aria-label="Chapter navigation">
          ${
            prevCh
              ? `<a class="btn" href="#/chapter/${e(prevCh.id)}">← ${e(t("chapterView.prevChapter"))}: ${formatNumber(prevCh.chapterNumber)}. ${e(prevCh.chapter)}</a>`
              : `<span></span>`
          }
          ${
            nextCh
              ? `<a class="btn primary" href="#/chapter/${e(nextCh.id)}">${e(t("chapterView.nextChapter"))}: ${formatNumber(nextCh.chapterNumber)}. ${e(nextCh.chapter)} →</a>`
              : `<span></span>`
          }
        </nav>
      </article>
    `;

    root.querySelector("#bookmark-chapter").onclick = () => {
      toggleBookmark(ch.id);
      paint();
    };
    root.querySelector("#complete-chapter").onclick = (ev) => {
      progress.complete(ch.id);
      ev.target.textContent = t("experiments.completed");
    };

    mountTranslation(
      root.querySelector("#chapter-objective-translation"),
      `${ch.objective}\n${ch.outcome}`
    );

    const quizHost = root.querySelector("#chapter-quiz");
    if (primaryMod?.quiz?.length) {
      mountQuiz(quizHost, primaryMod.id, primaryMod.quiz);
    } else {
      quizHost.innerHTML = `<p class="fact">${e(t("curriculum.coverageNoExp"))}</p>`;
    }

    audioCleanup = mountAudioControls(root.querySelector("#chapter-audio"), () => {
      const trOut = root.querySelector("#chapter-objective-translation .translated-text")?.textContent;
      if (getLanguage() !== "en" && trOut) return trOut;
      return `${ch.chapter}. ${introText} ${ch.objective} ${ch.outcome}`;
    });
  }

  paint();
  document.addEventListener("spark-language", paint);
  return () => {
    audioCleanup?.();
    document.removeEventListener("spark-language", paint);
  };
}
