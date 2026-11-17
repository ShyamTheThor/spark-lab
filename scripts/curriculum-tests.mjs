import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODULES } from "../src/modules/index.js";
import { INSTRUMENTS } from "../src/instruments/catalog.js";
import {
  filterMappings,
  mergeRecords,
  validMapping,
  grades,
  subjectsForGrade,
  SCHOOL_STAGES,
} from "../src/curriculum/model.js";
import { createTranslator, createTranslationHandler } from "../server/bhashini.mjs";
import { createServer } from "node:http";

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const seed = json("../src/curriculum/seed.json");

test("all curriculum links refer to real existing IDs and cover all grades 1-12 and all 75 modules/75 instruments for NCERT and Karnataka State Board", () => {
  assert.deepEqual(
    seed.boards.map((b) => b.id),
    ["ncert", "karnataka"]
  );
  const moduleIds = MODULES.map((m) => m.id);
  const instrumentIds = INSTRUMENTS.map((m) => m.id);
  assert.equal(moduleIds.length, 75);
  assert.equal(instrumentIds.length, 75);

  for (const board of ["ncert", "karnataka"]) {
    const rows = seed.mappings.filter((r) => r.board === board);
    assert.deepEqual(
      [...new Set(rows.map((r) => r.grade))].sort((a, b) => a - b),
      grades
    );
    const mappedModules = new Set(rows.flatMap((r) => r.modules));
    const mappedInstruments = new Set(rows.flatMap((r) => r.instruments));
    assert.equal(mappedModules.size, moduleIds.length);
    assert.equal(mappedInstruments.size, instrumentIds.length);
  }
  assert.equal(new Set(seed.mappings.map((r) => r.id)).size, seed.mappings.length);
  for (const r of seed.mappings)
    assert.ok(validMapping(r, seed.boards, moduleIds, instrumentIds), r.id);
});

test("chapters are strictly ordered by textbook chapterOrder/chapterNumber and have no duplicate (board,grade,subject,chapter)", () => {
  const seen = new Set();
  const byGroup = new Map();
  for (const r of seed.mappings) {
    const uniq = `${r.board}|${r.grade}|${r.subject}|${r.chapter}`;
    assert.ok(!seen.has(uniq), `Duplicate curriculum chapter: ${uniq}`);
    seen.add(uniq);
    const key = `${r.board}|${r.grade}|${r.subject}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(r);
  }
  for (const [key, list] of byGroup.entries()) {
    const sorted = filterMappings(list, {});
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i].chapterNumber >= sorted[i - 1].chapterNumber,
        `Out-of-order chapters in ${key}`
      );
    }
  }
});

test("subjectsForGrade enforces age-appropriate syllabus boundaries and upcoming boards are marked unsupported", () => {
  assert.equal(SCHOOL_STAGES.length, 4);
  for (let g = 1; g <= 5; g++) {
    const s = subjectsForGrade(g);
    assert.ok(!s.includes("Physics") && !s.includes("Chemistry") && !s.includes("Biology"));
  }
  for (let g = 11; g <= 12; g++) {
    const s = subjectsForGrade(g);
    assert.deepEqual(s, ["Physics", "Chemistry", "Biology", "Mathematics"]);
  }
  assert.ok(Array.isArray(seed.upcomingBoards) && seed.upcomingBoards.length >= 5);
  for (const b of seed.upcomingBoards) {
    assert.equal(b.supported, false);
    assert.equal(b.enabled, false);
  }
});

test("filter by board, grade, chapter, topic and disable seed via override", () => {
  const result = filterMappings(seed.mappings, {
    board: "ncert",
    grade: 10,
    chapter: "Electricity",
  });
  assert.equal(result.length, 1);
  assert.ok(result[0].modules.includes("circuit"));
  const knResult = filterMappings(seed.mappings, {
    board: "karnataka",
    grade: 10,
    chapter: "Electricity",
  });
  assert.equal(knResult.length, 1);
  assert.ok(knResult[0].modules.includes("circuit"));
  const disabled = mergeRecords(seed.mappings, [{ ...result[0], enabled: false }]);
  assert.equal(
    filterMappings(disabled, { board: "ncert", grade: 10, chapter: "Electricity" }).length,
    0
  );
  assert.equal(filterMappings(seed.mappings, { grade: 6, chapter: "Electricity" }).length, 0);
});

test("all eight locale dictionaries have the same keys and nonempty strings", () => {
  const en = json("../src/locales/en.json");
  for (const lang of ["hi", "kn", "ta", "te", "ml", "mr", "bn"]) {
    const d = json(`../src/locales/${lang}.json`);
    assert.deepEqual(Object.keys(d), Object.keys(en));
    for (const group of Object.keys(en)) {
      assert.deepEqual(Object.keys(d[group]), Object.keys(en[group]));
      for (const key of Object.keys(en[group])) assert.ok(d[group][key].trim());
    }
  }
  assert.equal(en.navigation.home, "Home");
  assert.equal(en.subjects.Physics, "Physics");
  assert.equal(en.boards.ncert, "CBSE / NCERT");
  assert.equal(en.labels.Battery, "Battery");
});

test("Bhashini config -> compute -> cached result, using simulated HTTP only", async () => {
  const calls = [];
  const translate = createTranslator({
    env: {
      BHASHINI_USER_ID: "test-user",
      BHASHINI_API_KEY: "test-key",
      BHASHINI_PIPELINE_ID: "test-pipeline",
    },
    fetcher: async (url, req) => {
      calls.push({ url, req });
      return {
        ok: true,
        json: async () =>
          calls.length === 1
            ? {
                pipelineResponseConfig: [
                  {
                    taskType: "translation",
                    config: [
                      {
                        serviceId: "test-service",
                        language: { sourceLanguage: "en", targetLanguage: "kn" },
                      },
                    ],
                  },
                ],
                pipelineInferenceAPIEndPoint: {
                  callbackURL: "https://example.test/compute",
                  inferenceApiKey: { name: "Authorization", value: "test-inference" },
                },
              }
            : { pipelineResponse: [{ taskType: "translation", output: [{ target: "ಪರೀಕ್ಷೆ" }] }] },
      };
    },
  });
  assert.equal(await translate("Test", "kn"), "ಪರೀಕ್ಷೆ");
  assert.equal(await translate("Test", "kn"), "ಪರೀಕ್ಷೆ");
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].req.body).pipelineTasks[0].taskType, "translation");
  assert.equal(JSON.parse(calls[1].req.body).pipelineTasks[0].config.serviceId, "test-service");
  assert.equal(calls[1].req.headers.Authorization, "test-inference");
});

test("keyless free translator works across all world & Indian languages without API keys; invalid target rejected", async () => {
  const translate = createTranslator({
    env: {},
    fetcher: async () => ({
      ok: true,
      json: async () => [[["Bonjour le monde", "Hello world"]]],
    }),
  });
  assert.equal(await translate("Hello world", "fr"), "Bonjour le monde");
  assert.equal(await translate("Hello world", "ja"), "Bonjour le monde");
  await assert.rejects(translate("test", "invalid-lang-code"), { status: 400 });
});

test("HTTP middleware validates input and translates via keyless free fallback when no Bhashini env is set", async () => {
  const server = createServer(
    createTranslationHandler({
      env: {},
      fetcher: async () => ({
        ok: true,
        json: async () => [[["ನಮಸ್ಕಾರ", "hello"]]],
      }),
    })
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/translate`;
    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", language: "kn" }),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.translation, "ನಮಸ್ಕಾರ");
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    assert.equal(response.status, 400);
    response = await fetch(url);
    assert.equal(response.status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
