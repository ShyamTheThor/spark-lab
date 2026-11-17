import { progress } from "../state.js";
import { t, formatNumber, getLanguage } from "../i18n/config.js";
import { translateText } from "../i18n/translation.js";

/**
 * Renders a short check-for-understanding quiz.
 * questions: [{ q, choices: string[], answer: number, explain: string }]
 * Preserves current question index, score, and answered state across language switches.
 */
export function mountQuiz(container, moduleId, questions) {
  questions = Array.isArray(questions)
    ? questions
        .filter(
          (q) =>
            q &&
            typeof q.q === "string" &&
            Array.isArray(q.choices) &&
            q.choices.length >= 2 &&
            q.choices.length <= 6 &&
            q.choices.every((c) => typeof c === "string") &&
            Number.isInteger(q.answer) &&
            q.answer >= 0 &&
            q.answer < q.choices.length
        )
        .slice(0, 20)
    : [];
  if (!questions || !questions.length) {
    container.hidden = true;
    return () => {};
  }
  container.hidden = false;
  let i = 0;
  let correct = 0;
  let answered = false;
  let pickedIdx = -1;
  let finished = false;

  const root = document.createElement("div");
  root.className = "quiz";
  root.innerHTML = `
    <div class="quiz-head">
      <span class="section-label"></span>
      <span class="quiz-count" aria-live="polite"></span>
    </div>
    <p class="quiz-q" id="${moduleId}-quiz-q"></p>
    <div class="quiz-choices" role="group" aria-labelledby="${moduleId}-quiz-q"></div>
    <p class="quiz-explain" role="status" hidden></p>
    <div class="btn-row">
      <button class="btn primary" data-act="next" type="button" hidden></button>
      <button class="btn" data-act="restart" type="button" hidden></button>
    </div>
  `;
  container.replaceChildren(root);

  const labelEl = root.querySelector(".section-label");
  const qEl = root.querySelector(".quiz-q");
  const choicesEl = root.querySelector(".quiz-choices");
  const explainEl = root.querySelector(".quiz-explain");
  const countEl = root.querySelector(".quiz-count");
  const nextBtn = root.querySelector('[data-act="next"]');
  const restartBtn = root.querySelector('[data-act="restart"]');

  async function localizeText(str) {
    const lang = getLanguage();
    if (lang === "en") return str;
    try {
      const res = await translateText(str, lang, { allowNetwork: false });
      return res.text || str;
    } catch {
      return str;
    }
  }

  async function renderState() {
    labelEl.textContent = t("quiz.title");
    nextBtn.textContent = t("quiz.nextQuestion");
    restartBtn.textContent = t("quiz.tryAgain");

    if (finished) {
      countEl.textContent = "✓";
      qEl.textContent = t("quiz.scored", {
        correct: formatNumber(correct),
        total: formatNumber(questions.length),
      });
      choicesEl.replaceChildren();
      explainEl.textContent =
        correct === questions.length ? t("quiz.fullMarks") : t("quiz.revisit");
      explainEl.hidden = false;
      nextBtn.hidden = true;
      restartBtn.hidden = false;
      return;
    }

    const item = questions[i];
    countEl.textContent = `${formatNumber(i + 1)} / ${formatNumber(questions.length)}`;
    qEl.textContent = await localizeText(item.q);

    const choiceTexts = await Promise.all(item.choices.map((c) => localizeText(c)));
    choicesEl.replaceChildren(
      ...choiceTexts.map((choice, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "quiz-choice";
        b.textContent = choice;
        if (answered) {
          b.disabled = true;
          if (idx === item.answer) b.classList.add("is-correct");
          else if (idx === pickedIdx) b.classList.add("is-wrong");
        }
        b.addEventListener("click", () => pick(idx));
        return b;
      })
    );

    if (answered) {
      explainEl.textContent = await localizeText(item.explain);
      explainEl.hidden = false;
      nextBtn.hidden = i >= questions.length - 1;
      restartBtn.hidden = true;
    } else {
      explainEl.hidden = true;
      nextBtn.hidden = true;
      restartBtn.hidden = true;
    }
  }

  function pick(idx) {
    if (answered) return;
    answered = true;
    pickedIdx = idx;
    const item = questions[i];
    if (idx === item.answer) correct++;
    if (i >= questions.length - 1) {
      finished = true;
      progress.recordQuiz(moduleId, correct, questions.length);
    }
    renderState();
  }

  nextBtn.addEventListener("click", () => {
    i++;
    answered = false;
    pickedIdx = -1;
    renderState();
  });
  restartBtn.addEventListener("click", () => {
    i = 0;
    correct = 0;
    answered = false;
    pickedIdx = -1;
    finished = false;
    renderState();
  });

  const onLang = () => {
    if (container.isConnected) renderState();
    else document.removeEventListener("spark-language", onLang);
  };
  document.addEventListener("spark-language", onLang);

  renderState();
  return () => document.removeEventListener("spark-language", onLang);
}
