// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  extractPanelObservations,
  extractTheoryText,
  openLabReportModal,
  closeLabReportModal,
  showSnapshotToast,
} from "../src/features/labReport.js";

beforeEach(() => {
  document.body.innerHTML = '<main><div id="panel"></div><div id="stage-wrap"></div></main>';
});

afterEach(() => {
  closeLabReportModal();
  document.body.innerHTML = "";
});

it("extracts panel observations from labels with outputs and inputs", () => {
  const panel = document.getElementById("panel");
  panel.innerHTML = `
    <label>
      <span>Length: <output id="out-len">1.5 m</output></span>
      <input type="range" id="len" min="0.5" max="2" value="1.5">
    </label>
    <label>
      <span>Gravity</span>
      <select id="grav">
        <option value="9.8" selected>Earth (9.8 m/s²)</option>
        <option value="1.6">Moon (1.6 m/s²)</option>
      </select>
    </label>
    <div class="readout">
      <span class="label">Time Period</span>
      <b class="value">2.46 s</b>
    </div>
  `;

  const obs = extractPanelObservations(panel);
  expect(obs.length).toBe(3);
  expect(obs.find((o) => o.name.includes("Length")).value).toBe("1.5 m");
  expect(obs.find((o) => o.name.includes("Gravity")).value).toBe("Earth (9.8 m/s²)");
  expect(obs.find((o) => o.name.includes("Time Period")).value).toBe("2.46 s");
});

it("extracts theory text from HTML", () => {
  const html = "<p>Snell's Law states that n1 * sin(theta1) = n2 * sin(theta2).</p>";
  const theory = extractTheoryText(html);
  expect(theory).toContain("Snell's Law");
});

it("opens lab report modal with student and module details", () => {
  const panel = document.getElementById("panel");
  panel.innerHTML = '<label><span>Resistance</span><output>10 Ω</output></label>';

  const fakeModule = {
    id: "circuit",
    name: "Ohm's Law Virtual Circuit",
    subject: "physics",
    tag: "Class 10 · Electricity",
    lesson: "<p>Ohm's law gives V = IR.</p>",
    scene: {},
  };

  const fakeViewer = {
    takeSnapshot: vi.fn(() => "data:image/png;base64,fakeimg"),
  };

  openLabReportModal({
    module: fakeModule,
    viewer: fakeViewer,
    panel,
    currentUser: { displayName: "Rohan Sharma", email: "rohan@example.com" },
    completed: true,
  });

  const modal = document.querySelector(".lab-report-modal");
  expect(modal).not.toBeNull();
  expect(document.querySelector("#reportStudentName").value).toBe("Rohan Sharma");
  expect(document.querySelector("#reportTitle").textContent).toBe("Ohm's Law Virtual Circuit");
  expect(document.querySelector(".report-status-pill").textContent).toContain("Completed");
  expect(document.querySelector("#reportSnapshotImg").src).toBe("data:image/png;base64,fakeimg");

  closeLabReportModal();
  expect(document.querySelector(".lab-report-modal")).toBeNull();
});

it("shows snapshot toast and can be dismissed", () => {
  const stageWrap = document.getElementById("stage-wrap");
  const fakeModule = { id: "pendulum", name: "Simple Pendulum" };

  showSnapshotToast({
    stageWrap,
    dataUrl: "data:image/png;base64,fake",
    module: fakeModule,
    onOpenReport: vi.fn(),
  });

  const toast = stageWrap.querySelector(".snapshot-toast");
  expect(toast).not.toBeNull();
  expect(toast.querySelector(".toast-title").textContent).toContain("Snapshot");

  toast.querySelector(".toast-dismiss").click();
  expect(stageWrap.querySelector(".snapshot-toast")).toBeNull();
});
