import {mountAccessibleScene} from "../partner/visuals.js";
import { attachCurriculum } from "../curriculum/view.js";
import { mountTranslation } from "../i18n/translation.js";
import * as T from "three";
import { INSTRUMENTS, findInstrument } from "../instruments/catalog.js";
import { buildInstrument } from "../instruments/models.js";
import { createStage } from "./stage.js";
import { escapeHtml as esc } from "../lib/html.js";
import { progress } from "../state.js";
import { t, tSubject, formatNumber } from "../i18n/config.js";

export function mount(root, id) {
  const item = findInstrument(id);
  if (item) return detail(root, item);

  let searchVal = "";
  let subjVal = "All";

  function paintList() {
    root.innerHTML = `
      <a class="back-btn" href="#/">← ${esc(t("navigation.home"))}</a>
      <section class="hero">
        <span class="eyebrow">${esc(t("instruments.eyebrow"))}</span>
        <h1>${esc(t("instruments.title"))}</h1>
        <p>${esc(t("instruments.subtitle"))}</p>
      </section>
      <div class="feature-filters">
        <label>${esc(t("instruments.searchLabel"))}
          <input id="instrument-search" class="text-input" type="search" value="${esc(searchVal)}" placeholder="${esc(t("instruments.searchPlaceholder"))}">
        </label>
        <label>${esc(t("curriculum.subject"))}
          <select id="instrument-subject" class="text-input">
            <option value="All">${esc(t("curriculum.all"))}</option>
            ${["Physics", "Chemistry", "Biology", "Mathematics"]
              .map(
                (s) =>
                  `<option value="${s}" ${subjVal === s ? "selected" : ""}>${esc(tSubject(s))}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      <p id="instrument-count" class="fact" aria-live="polite"></p>
      <div class="bench" id="instrument-cards"></div>
    `;
    const q = root.querySelector("#instrument-search");
    const filter = root.querySelector("#instrument-subject");
    const cards = root.querySelector("#instrument-cards");

    function updateCards() {
      searchVal = q.value;
      subjVal = filter.value;
      const items = INSTRUMENTS.filter(
        (i) =>
          (subjVal === "All" || i.subject === subjVal) &&
          `${i.name} ${i.applications} ${tSubject(i.subject)}`
            .toLowerCase()
            .includes(searchVal.toLowerCase())
      );
      root.querySelector("#instrument-count").textContent = t("instruments.countLabel", {
        count: formatNumber(items.length),
      });
      cards.innerHTML =
        items
          .map(
            (i) =>
              `<a class="card instrument-card" href="#/instruments/${i.id}"><span class="tag">${esc(tSubject(i.subject))} · ${esc(t("instruments.interactive3d"))}</span><span class="instrument-glyph" aria-hidden="true">${i.subject === "Physics" ? "⚙" : i.subject === "Chemistry" ? "⚗" : i.subject === "Biology" ? "◉" : "△"}</span><h3>${esc(i.name)}</h3><p>${esc(i.applications)}</p><span class="fact">${formatNumber(i.components.length)} ${esc(t("instruments.components"))} · ${progress.for(i.id).completed ? esc(t("experiments.completed")) : `${esc(t("curriculum.explore"))} →`}</span></a>`
          )
          .join("") || `<p class="fact">${esc(t("search.noResults"))}</p>`;
    }
    q.oninput = updateCards;
    filter.onchange = updateCards;
    updateCards();
  }

  paintList();
  document.addEventListener("spark-language", paintList);
  return () => document.removeEventListener("spark-language", paintList);
}


function mountInstrumentVoiceAssistant(container, item, selectComponent) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const quickQuestions = [
    `What is the working principle of ${item.name}?`,
    `What are the main components?`,
    `Where is ${item.name} used?`,
  ];

  container.innerHTML = `
    <div class="instrument-voice-card" aria-label="Voice Lab Assistant">
      <div class="voice-assistant-head">
        <div>
          <span class="eyebrow">🎙️ Voice Lab Assistant</span>
          <h3>Ask about ${esc(item.name)}</h3>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm primary" type="button" id="va-mic-btn">🎤 Ask by Voice</button>
          <button class="btn btn-sm" type="button" id="va-speak-btn" title="Read explanation aloud">🔊 Read Aloud</button>
        </div>
      </div>
      <div class="chip-row">
        ${quickQuestions
          .map(
            (q) =>
              `<button type="button" class="chip" data-va-q="${esc(q)}">${esc(q)}</button>`
          )
          .join("")}
      </div>
      <form id="va-form" class="voice-ask-row">
        <input type="text" id="va-input" class="text-input" placeholder="Ask about parts, principle, or applications…" aria-label="Ask Voice Lab Assistant" />
        <button type="submit" class="btn">Ask</button>
      </form>
      <p class="voice-assistant-reply" id="va-reply" role="status">Tap <strong>🎤 Ask by Voice</strong> or click a quick question to explore ${esc(item.name)} hands-free (works offline).</p>
    </div>
  `;

  const replyEl = container.querySelector("#va-reply");
  const inputEl = container.querySelector("#va-input");
  const micBtn = container.querySelector("#va-mic-btn");
  const speakBtn = container.querySelector("#va-speak-btn");
  let lastAnswer = `${item.name}. ${item.description} Working principle: ${item.principle}`;

  function speakText(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = document.documentElement.lang || "en-IN";
      utter.rate = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore speechSynthesis errors */
    }
  }

  function answerQuery(rawQ, autoSpeak = true) {
    const q = (rawQ || "").trim();
    if (!q) return;
    inputEl.value = q;
    const lower = q.toLowerCase();

    // Check if user mentioned a specific 3D component
    const matchedPart = item.components.find((c) => lower.includes(c.toLowerCase()));
    if (matchedPart) {
      selectComponent?.(matchedPart);
      lastAnswer = `Highlighted component: ${matchedPart}. ${item.name} uses ${matchedPart} as one of its ${item.components.length} key assemblies (${item.components.join(", ")}). ${item.principle}`;
    } else if (lower.includes("part") || lower.includes("component") || lower.includes("structure")) {
      if (item.components[0]) selectComponent?.(item.components[0]);
      lastAnswer = `${item.name} consists of ${item.components.length} key components: ${item.components.join(", ")}. Tap any component button to highlight it in 3D.`;
    } else if (lower.includes("principle") || lower.includes("work") || lower.includes("how")) {
      lastAnswer = `Working Principle of ${item.name}: ${item.principle}`;
    } else if (lower.includes("use") || lower.includes("application") || lower.includes("where")) {
      lastAnswer = `Applications of ${item.name}: ${item.applications}`;
    } else {
      lastAnswer = `${item.name}: ${item.description} Principle: ${item.principle} Applications: ${item.applications}`;
    }

    replyEl.textContent = lastAnswer;
    if (autoSpeak) speakText(lastAnswer);
  }

  container.querySelectorAll("[data-va-q]").forEach((btn) => {
    btn.onclick = () => answerQuery(btn.dataset.vaQ, true);
  });

  container.querySelector("#va-form").onsubmit = (e) => {
    e.preventDefault();
    answerQuery(inputEl.value, true);
  };

  speakBtn.onclick = () => speakText(lastAnswer);

  let recognition = null;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      micBtn.textContent = "🛑 Listening…";
      micBtn.setAttribute("aria-pressed", "true");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) answerQuery(transcript, true);
    };
    recognition.onerror = () => {
      replyEl.textContent = "Voice capture unavailable or permission denied — type your question or tap a chip above (100% offline ready).";
    };
    recognition.onend = () => {
      micBtn.textContent = "🎤 Ask by Voice";
      micBtn.setAttribute("aria-pressed", "false");
    };

    micBtn.onclick = () => {
      try {
        recognition.start();
      } catch {
        recognition.stop();
      }
    };
  } else {
    micBtn.onclick = () => {
      replyEl.textContent = "Browser speech recognition is unavailable offline here — use the quick-question chips or type below, then tap 🔊 Read Aloud.";
      inputEl.focus();
    };
  }

  return () => {
    try {
      recognition?.abort();
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };
}

function detail(root, item) {
  progress.markVisited(item.id);
  root.innerHTML = `
    <a class="back-btn" href="#/instruments">← <span data-i18n="instruments.backCabinet"></span></a>
    <div class="workbench feature-workbench">
      <div class="stage-column">
        <div class="feature-stage" id="instrument-stage">
          <span class="module-eyebrow">${esc(tSubject(item.subject))} · ${esc(t("instruments.interactive3d"))}</span>
          <span class="viewport-hint" data-i18n="experiments.orbitHint"></span>
        </div>
        <div class="btn-row stage-controls">
          <button class="btn" id="reset-instrument" data-i18n="instruments.resetView"></button>
          <button class="btn" id="explode" aria-pressed="false" data-i18n="instruments.separateParts"></button>
          <button class="btn" id="spin" aria-pressed="false" data-i18n="instruments.autoRotate"></button>
        </div>
      </div>
      <aside class="notebook">
        <span class="eyebrow">${esc(tSubject(item.subject))}</span>
        <h1>${esc(item.name)}</h1>
        <p>${esc(item.description)}</p>
        <div class="notebook-block">
          <h3 data-i18n="instruments.workingPrinciple"></h3>
          <p>${esc(item.principle)}</p>
        </div>
        <div class="notebook-block">
          <h3 data-i18n="instruments.applications"></h3>
          <p>${esc(item.applications)}</p>
        </div>
        <div class="notebook-block">
          <h3 data-i18n="instruments.components"></h3>
          <div class="btn-row">${item.components.map((c, i) => `<button class="btn" data-part="${i}">${esc(c)}</button>`).join("")}</div>
          <p id="part-info" role="status" data-i18n="instruments.selectComponent"></p>
        </div>
        <p class="fact" data-i18n="instruments.modelNote"></p>
        <button class="btn primary" id="complete-instrument"></button>
      </aside>
    </div>`;

  const syncLabels = () => {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    const compBtn = root.querySelector("#complete-instrument");
    if (compBtn) {
      compBtn.textContent = progress.for(item.id).completed
        ? t("experiments.completed")
        : t("experiments.complete");
    }
  };
  syncLabels();

  root.querySelector("#complete-instrument").onclick = (e) => {
    progress.complete(item.id);
    e.target.textContent = t("experiments.completed");
  };
  const voiceBox = document.createElement("div");
  const extra = document.createElement("section");
  const translation = document.createElement("div");
  root.querySelector("aside").append(voiceBox, translation, extra);
  mountTranslation(translation, [item.description, item.principle, item.applications].join("\n"));
  attachCurriculum(extra, item.id, "instruments");

  const model = buildInstrument(item);
  const stage = createStage(root.querySelector("#instrument-stage"));
  if (!stage) return () => model.dispose();
  stage.scene.add(model.root);
  const sceneCleanup=mountAccessibleScene(stage.scene,root.querySelector("#instrument-stage").parentElement);
  let separated = false;
  const select = (name) => {
    model.parts.forEach((p) => {
      if (!p.userData.originalMaterial) p.userData.originalMaterial = p.material;
      p.material = p.userData.originalMaterial;
    });
    model.parts
      .filter((p) => p.userData.component === name || p.userData.alsoComponents?.includes(name))
      .forEach((p) => (p.material = highlight));
    root.querySelector("#part-info").textContent = `${name}`;
  };
  const highlight = new T.MeshStandardMaterial({
    color: 0xf0a13c,
    emissive: 0x503010,
    roughness: 0.4,
  });
  root
    .querySelectorAll("[data-part]")
    .forEach((b) => (b.onclick = () => select(item.components[+b.dataset.part])));
  let down;
  const canvas = stage.renderer.domElement;
  canvas.onpointerdown = (e) => {
    down = [e.clientX, e.clientY];
  };
  canvas.onpointerup = (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: (-(e.clientY - r.top) / r.height) * 2 + 1,
      },
      stage.camera
    );
    const hit = ray.intersectObjects(model.parts)[0];
    if (hit) select(hit.object.userData.component);
  };
  root.querySelector("#reset-instrument").onclick = () => stage.reset();
  root.querySelector("#spin").onclick = (e) => {
    stage.controls.autoRotate = !stage.controls.autoRotate;
    e.target.setAttribute("aria-pressed", stage.controls.autoRotate);
  };
  root.querySelector("#explode").onclick = (e) => {
    separated = !separated;
    e.target.setAttribute("aria-pressed", separated);
    model.parts.forEach((p, i) => {
      p.position.copy(p.userData.home);
      if (separated)
        p.position.add(
          new T.Vector3(
            ((i % 3) - 1) * 0.4,
            Math.floor(i / 3) * 0.05 + 0.2,
            ((i % 2) - 0.5) * 0.6
          )
        );
    });
  };
  const voiceCleanup = mountInstrumentVoiceAssistant(voiceBox, item, select);
  document.addEventListener("spark-language", syncLabels);
  return () => {
    document.removeEventListener("spark-language", syncLabels);
    voiceCleanup();
    sceneCleanup();
    stage.dispose();
    model.dispose();
    highlight.dispose();
  };
}
