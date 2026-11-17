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
  const extra = document.createElement("section");
  const translation = document.createElement("div");
  root.querySelector("aside").append(translation, extra);
  mountTranslation(translation, [item.description, item.principle, item.applications].join("\n"));
  attachCurriculum(extra, item.id, "instruments");

  const model = buildInstrument(item);
  const stage = createStage(root.querySelector("#instrument-stage"));
  if (!stage) return () => model.dispose();
  stage.scene.add(model.root);
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
  document.addEventListener("spark-language", syncLabels);
  return () => {
    document.removeEventListener("spark-language", syncLabels);
    stage.dispose();
    model.dispose();
    highlight.dispose();
  };
}
