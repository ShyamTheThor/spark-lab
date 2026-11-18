import { MODULES, SUBJECTS, loadModule } from "../modules/index.js";
import { escapeHtml as esc } from "../lib/html.js";
import { t, tSubject, tClass, formatNumber } from "../i18n/config.js";
import { mountQuiz } from "../learn/quiz.js";
import { progress } from "../state.js";
import {
  loadLiveQuizSession,
  joinLiveQuizParticipant,
  submitLiveQuizAnswer,
  subscribeLiveQuizRoom,
} from "./classroomStore.js";

export async function mount(root) {
  let activeSubject = "";
  let activeQuizModule = null;
  let mode = "browse"; // 'browse' | 'practice' | 'realtime-sprint' | 'live-room'
  let liveSessionCode = "";
  let liveParticipantId = "";
  let liveStudentName = "";
  let liveError = "";
  let sprintTimer = null;
  let livePollTimer = null;
  let unsubRoomSync = null;

  function clearTimers() {
    if (sprintTimer) {
      clearInterval(sprintTimer);
      sprintTimer = null;
    }
    if (livePollTimer) {
      clearInterval(livePollTimer);
      livePollTimer = null;
    }
    if (unsubRoomSync) {
      unsubRoomSync();
      unsubRoomSync = null;
    }
  }

  async function startRealtimeSprint() {
    clearTimers();
    mode = "realtime-sprint";
    const poolMods = MODULES.filter((m) => !activeSubject || m.subject === activeSubject);
    const chosen = [...poolMods].sort(() => Math.random() - 0.5).slice(0, 6);
    const loaded = await Promise.all(chosen.map((m) => loadModule(m.id)));
    const questions = loaded
      .flatMap((m) =>
        (m?.quiz || []).slice(0, 2).map((q) => ({
          ...q,
          moduleName: m.name,
          subject: m.subject,
          icon: m.icon,
        }))
      )
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);

    let qIdx = 0;
    let score = 0;
    let streak = 0;
    let correctCount = 0;
    let timeLeft = 20;
    let locked = false;

    function renderSprintQuestion() {
      clearTimers();
      if (qIdx >= questions.length) {
        root.innerHTML = `
          <button class="back-btn" type="button" id="sprint-back">← ${esc(t("navigation.quizzes"))}</button>
          <article class="notebook realtime-quiz-card">
            <span class="eyebrow">⚡ Real-Time Quiz Complete</span>
            <h1>Final Score: ${formatNumber(score)} pts</h1>
            <p class="fact">You answered <strong>${formatNumber(correctCount)} / ${formatNumber(questions.length)}</strong> questions accurately with real-time speed bonuses!</p>
            <div class="learning-stats" style="margin:16px 0;">
              <article><b>${formatNumber(score)}</b><span>Total Points</span></article>
              <article><b>${Math.round((correctCount / Math.max(1, questions.length)) * 100)}%</b><span>Accuracy</span></article>
              <article><b>🔥 ${formatNumber(streak)}</b><span>Final Streak</span></article>
            </div>
            <div class="btn-row">
              <button class="btn primary" type="button" id="sprint-again">⚡ Play Again</button>
              <button class="btn" type="button" id="sprint-exit">Back to Quizzes</button>
            </div>
          </article>
        `;
        root.querySelector("#sprint-back").onclick = () => {
          mode = "browse";
          paint();
        };
        root.querySelector("#sprint-exit").onclick = () => {
          mode = "browse";
          paint();
        };
        root.querySelector("#sprint-again").onclick = () => startRealtimeSprint();
        return;
      }

      const item = questions[qIdx];
      timeLeft = 20;
      locked = false;

      root.innerHTML = `
        <button class="back-btn" type="button" id="sprint-back">← ${esc(t("navigation.quizzes"))}</button>
        <article class="notebook realtime-quiz-card">
          <div class="rt-quiz-topbar">
            <span class="eyebrow">${item.icon || "⚡"} ${esc(tSubject(item.subject))} · ${esc(item.moduleName)}</span>
            <div class="rt-hud">
              <span class="rt-pill">Q ${qIdx + 1}/${questions.length}</span>
              <span class="rt-pill is-score">⭐ ${formatNumber(score)} pts</span>
              <span class="rt-pill is-streak">🔥 ${streak}x</span>
              <span class="rt-pill is-timer" id="rt-timer-pill">⏱️ ${timeLeft}s</span>
            </div>
          </div>
          <div class="rt-timer-bar"><div class="rt-timer-fill" id="rt-timer-fill" style="width:100%"></div></div>
          <h2 class="quiz-q" style="margin-top:14px;">${esc(item.q)}</h2>
          <div class="quiz-choices" id="rt-choices">
            ${item.choices
              .map(
                (c, idx) =>
                  `<button type="button" class="quiz-choice" data-idx="${idx}">${esc(c)}</button>`
              )
              .join("")}
          </div>
          <p class="quiz-explain" id="rt-explain" hidden></p>
          <div class="btn-row" style="margin-top:12px;">
            <button class="btn primary" type="button" id="rt-next" hidden>${qIdx + 1 < questions.length ? "Next Question →" : "See Results →"}</button>
          </div>
        </article>
      `;

      root.querySelector("#sprint-back").onclick = () => {
        clearTimers();
        mode = "browse";
        paint();
      };

      const finishTurn = (pickedIdx) => {
        if (locked) return;
        locked = true;
        clearTimers();
        const isRight = pickedIdx === item.answer;
        if (isRight) {
          streak++;
          correctCount++;
          const pts = 500 + Math.round((timeLeft / 20) * 500) + streak * 50;
          score += pts;
        } else {
          streak = 0;
        }
        root.querySelectorAll("#rt-choices .quiz-choice").forEach((btn, idx) => {
          btn.disabled = true;
          if (idx === item.answer) btn.classList.add("is-correct");
          else if (idx === pickedIdx) btn.classList.add("is-wrong");
        });
        const exp = root.querySelector("#rt-explain");
        exp.hidden = false;
        exp.textContent = `${pickedIdx === -1 ? "⏰ Time's up! " : isRight ? "✅ Fast & Correct! " : "❌ Not quite. "}${item.explain}`;
        root.querySelector("#rt-next").hidden = false;
      };

      root.querySelectorAll("#rt-choices .quiz-choice").forEach((btn) => {
        btn.onclick = () => finishTurn(Number(btn.dataset.idx));
      });
      root.querySelector("#rt-next").onclick = () => {
        qIdx++;
        renderSprintQuestion();
      };

      sprintTimer = setInterval(() => {
        timeLeft = Math.max(0, +(timeLeft - 0.25).toFixed(2));
        const pill = root.querySelector("#rt-timer-pill");
        const fill = root.querySelector("#rt-timer-fill");
        if (pill) pill.textContent = `⏱️ ${Math.ceil(timeLeft)}s`;
        if (fill) fill.style.width = `${(timeLeft / 20) * 100}%`;
        if (timeLeft <= 0) {
          finishTurn(-1);
        }
      }, 250);
    }

    renderSprintQuestion();
  }

  function renderLiveRoom() {
    clearTimers();
    const drawRoom = () => {
      const session = loadLiveQuizSession();
      if (!session || session.code !== liveSessionCode) {
        root.innerHTML = `
          <button class="back-btn" type="button" id="live-exit">← ${esc(t("navigation.quizzes"))}</button>
          <article class="notebook">
            <h2>Live Quiz Session Ended</h2>
            <p class="fact">The teacher closed this live quiz room or the room code expired.</p>
          </article>
        `;
        root.querySelector("#live-exit").onclick = () => {
          mode = "browse";
          paint();
        };
        return;
      }

      const leaderboard = Object.values(session.participants || {}).sort((a, b) => b.score - a.score);
      const me = session.participants?.[liveParticipantId];

      if (session.status === "lobby") {
        root.innerHTML = `
          <button class="back-btn" type="button" id="live-exit">← Leave Room</button>
          <article class="notebook realtime-quiz-card">
            <span class="eyebrow">📡 Live Classroom Room · Code #${esc(session.code)}</span>
            <h1>${esc(session.title)}</h1>
            <p class="fact">Hosted by <strong>${esc(session.hostName)}</strong> · Waiting for teacher to start the quiz…</p>
            <div class="live-lobby-list">
              <h3>Connected Students (${leaderboard.length})</h3>
              <div class="chip-row" style="margin-top:8px;">
                ${leaderboard.map((p) => `<span class="tag">${p.id === liveParticipantId ? "⭐ " : ""}${esc(p.name)}</span>`).join("")}
              </div>
            </div>
          </article>
        `;
        root.querySelector("#live-exit").onclick = () => {
          clearTimers();
          mode = "browse";
          paint();
        };
        return;
      }

      if (session.status === "ended" || session.currentIndex >= session.questions.length) {
        root.innerHTML = `
          <button class="back-btn" type="button" id="live-exit">← ${esc(t("navigation.quizzes"))}</button>
          <article class="notebook realtime-quiz-card">
            <span class="eyebrow">🏆 Live Quiz Podium · Room #${esc(session.code)}</span>
            <h1>${esc(session.title)} — Final Leaderboard</h1>
            <ol class="live-podium-list">
              ${leaderboard
                .map(
                  (p, idx) => `
                <li class="${p.id === liveParticipantId ? "is-me" : ""}">
                  <span><b>#${idx + 1}</b> ${esc(p.name)}</span>
                  <code>${formatNumber(p.score)} pts</code>
                </li>`
                )
                .join("")}
            </ol>
          </article>
        `;
        root.querySelector("#live-exit").onclick = () => {
          clearTimers();
          mode = "browse";
          paint();
        };
        return;
      }

      const qIdx = session.currentIndex;
      const item = session.questions[qIdx];
      const alreadyAnswered = me?.answers?.[qIdx];
      const elapsedSec = Math.floor((Date.now() - (session.questionStartedAt || Date.now())) / 1000);
      const timeLeft = Math.max(0, (session.timePerQuestion || 20) - elapsedSec);

      root.innerHTML = `
        <button class="back-btn" type="button" id="live-exit">← Leave Room</button>
        <article class="notebook realtime-quiz-card">
          <div class="rt-quiz-topbar">
            <span class="eyebrow">📡 Live Room #${esc(session.code)} · Q ${qIdx + 1}/${session.questions.length}</span>
            <div class="rt-hud">
              <span class="rt-pill is-score">⭐ ${formatNumber(me?.score || 0)} pts</span>
              <span class="rt-pill is-timer">⏱️ ${timeLeft}s</span>
            </div>
          </div>
          <h2 class="quiz-q">${esc(item.q)}</h2>
          <div class="quiz-choices">
            ${item.choices
              .map((c, idx) => {
                let cls = "quiz-choice";
                if (alreadyAnswered !== undefined) {
                  if (idx === item.answer) cls += " is-correct";
                  else if (idx === alreadyAnswered.choiceIndex) cls += " is-wrong";
                }
                return `<button type="button" class="${cls}" data-live-idx="${idx}" ${alreadyAnswered !== undefined || timeLeft <= 0 ? "disabled" : ""}>${esc(c)}</button>`;
              })
              .join("")}
          </div>
          ${
            alreadyAnswered !== undefined
              ? `<p class="quiz-explain">${alreadyAnswered.isCorrect ? `✅ +${alreadyAnswered.points} pts! ` : "❌ Incorrect. "}${esc(item.explain || "")}</p>`
              : ""
          }
          <div style="margin-top:14px;">
            <h4>Live Standings</h4>
            <ol class="live-podium-list">
              ${leaderboard
                .slice(0, 5)
                .map(
                  (p, idx) => `
                <li class="${p.id === liveParticipantId ? "is-me" : ""}">
                  <span>#${idx + 1} ${esc(p.name)}</span>
                  <code>${formatNumber(p.score)} pts</code>
                </li>`
                )
                .join("")}
            </ol>
          </div>
        </article>
      `;

      root.querySelector("#live-exit").onclick = () => {
        clearTimers();
        mode = "browse";
        paint();
      };
      root.querySelectorAll("[data-live-idx]").forEach((btn) => {
        btn.onclick = async () => {
          const choice = Number(btn.dataset.liveIdx);
          await submitLiveQuizAnswer(
            liveParticipantId,
            qIdx,
            choice,
            choice === item.answer,
            timeLeft,
            session.timePerQuestion || 20,
            liveSessionCode
          );
          drawRoom();
        };
      });
    };

    drawRoom();
    unsubRoomSync = subscribeLiveQuizRoom(liveSessionCode, () => drawRoom());
    livePollTimer = setInterval(drawRoom, 1000);
  }

  async function paint() {
    clearTimers();
    if (mode === "live-room") return renderLiveRoom();
    if (mode === "practice" && activeQuizModule) {
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
        mode = "browse";
        paint();
      };
      mountQuiz(root.querySelector("#quiz-runner"), m.id, m.quiz);
      return;
    }

    const activeLive = loadLiveQuizSession();
    const list = MODULES.filter((m) => !activeSubject || m.subject === activeSubject);
    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${esc(t("navigation.quizzes"))}</span>
        <h1>${esc(t("quiz.allQuizzesTitle"))}</h1>
        <p>${esc(t("quiz.allQuizzesDesc"))}</p>
      </section>

      <!-- Real-Time Quiz Hub (Live Classroom Room + Timed Real-Time Sprint) -->
      <section class="realtime-quiz-hub" aria-label="Real-Time Quizzes">
        <article class="engage-card engage-spark">
          <span class="engage-pill">⚡ Real-Time Timed Challenge</span>
          <h3>Speed &amp; Streak STEM Quiz</h3>
          <p>Race against a live 20-second countdown per question with instant speed multipliers and streak bonuses.</p>
          <div class="btn-row" style="margin-top:auto;">
            <button class="btn primary" type="button" id="start-rt-sprint">⚡ Start Real-Time Quiz →</button>
          </div>
        </article>

        <article class="engage-card engage-assign">
          <span class="engage-pill">📡 Join Live Classroom Quiz</span>
          <h3>Enter Teacher Room Code</h3>
          <p>${
            activeLive && activeLive.status !== "ended"
              ? `Active session detected: <strong>${esc(activeLive.title)}</strong> (Code: <code>${esc(activeLive.code)}</code>)`
              : "Join a live teacher-hosted quiz room in real time with live leaderboard rankings."
          }</p>
          <form id="join-live-quiz-form" class="live-join-row">
            <input type="text" id="live-student-name" class="text-input" placeholder="Your Name" value="${esc(liveStudentName)}" required />
            <input type="text" id="live-room-code" class="text-input" placeholder="6-Digit Code" maxlength="6" value="${esc(activeLive?.status !== "ended" ? activeLive?.code || "" : "")}" required />
            <button class="btn primary" type="submit">Join Live</button>
          </form>
          ${liveError ? `<p class="fact modal-error" style="margin-top:4px;">${esc(liveError)}</p>` : ""}
        </article>
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

    root.querySelector("#start-rt-sprint")?.addEventListener("click", () => startRealtimeSprint());

    root.querySelector("#join-live-quiz-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      liveError = "";
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      liveStudentName = root.querySelector("#live-student-name").value.trim();
      const code = root.querySelector("#live-room-code").value.trim();
      const joined = await joinLiveQuizParticipant(code, liveStudentName);
      if (submitBtn) submitBtn.disabled = false;
      if (!joined) {
        liveError = "No active live quiz found for that room code. Ask your teacher to launch one in the Teacher Portal.";
        paint();
        return;
      }
      liveSessionCode = code;
      liveParticipantId = joined.participantId;
      mode = "live-room";
      paint();
    });

    root.querySelectorAll("[data-qsubj]").forEach((btn) => {
      btn.onclick = () => {
        activeSubject = btn.dataset.qsubj;
        paint();
      };
    });
    root.querySelectorAll("[data-start-quiz]").forEach((btn) => {
      btn.onclick = () => {
        activeQuizModule = MODULES.find((m) => m.id === btn.dataset.startQuiz) || null;
        mode = "practice";
        paint();
      };
    });
  }

  await paint();
  const onStorage = (e) => {
    if (e.key === "sparklab.live.quiz.v1" && (mode === "browse" || mode === "live-room")) {
      paint();
    }
  };
  window.addEventListener("storage", onStorage);
  document.addEventListener("spark-language", paint);
  return () => {
    clearTimers();
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("spark-language", paint);
  };
}
