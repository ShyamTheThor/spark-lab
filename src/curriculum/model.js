export const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const SCHOOL_STAGES = [
  { id: "primary", labelKey: "curriculum.stagePrimary", label: "Primary School", min: 1, max: 5 },
  { id: "middle", labelKey: "curriculum.stageMiddle", label: "Middle School", min: 6, max: 8 },
  { id: "secondary", labelKey: "curriculum.stageSecondary", label: "Secondary School", min: 9, max: 10 },
  { id: "senior", labelKey: "curriculum.stageSenior", label: "Senior Secondary / PUC", min: 11, max: 12 },
];

export const subjects = [
  "Environmental Studies",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
];

export function subjectsForGrade(grade) {
  const g = Number(grade);
  if (g === 1) return ["Mathematics"];
  if (g >= 2 && g <= 5) return ["Mathematics", "Environmental Studies"];
  if (g >= 6 && g <= 10) return ["Science", "Mathematics"];
  if (g >= 11 && g <= 12) return ["Physics", "Chemistry", "Biology", "Mathematics"];
  return [...subjects];
}

export function stageForGrade(grade) {
  const g = Number(grade);
  return SCHOOL_STAGES.find((s) => g >= s.min && g <= s.max) || null;
}

export function sortByTextbookOrder(rows) {
  return [...rows].sort((a, b) => {
    if ((a.grade || 0) !== (b.grade || 0)) return (a.grade || 0) - (b.grade || 0);
    const subjCmp = subjects.indexOf(a.subject) - subjects.indexOf(b.subject);
    if (subjCmp !== 0) return subjCmp;
    const chNumA = Number.isFinite(a.chapterNumber) ? a.chapterNumber : Number.isFinite(a.chapterOrder) ? a.chapterOrder : 9999;
    const chNumB = Number.isFinite(b.chapterNumber) ? b.chapterNumber : Number.isFinite(b.chapterOrder) ? b.chapterOrder : 9999;
    if (chNumA !== chNumB) return chNumA - chNumB;
    const ordA = Number.isFinite(a.chapterOrder) ? a.chapterOrder : chNumA;
    const ordB = Number.isFinite(b.chapterOrder) ? b.chapterOrder : chNumB;
    if (ordA !== ordB) return ordA - ordB;
    return (a.topicOrder || 0) - (b.topicOrder || 0);
  });
}

export function mergeRecords(seed, overrides = []) {
  const map = new Map(seed.map((r) => [r.id, r]));
  for (const r of overrides) map.set(r.id, r);
  return [...map.values()];
}

export function filterMappings(rows, filters = {}) {
  const filtered = rows.filter(
    (r) =>
      r.enabled &&
      ["board", "grade", "subject", "textbookId", "chapter", "chapterId", "topic", "coverageStatus"].every(
        (k) => !filters[k] || String(r[k]) === String(filters[k])
      )
  );
  return sortByTextbookOrder(filtered);
}

export function validMapping(r, boards, modules, instruments) {
  const hasContent =
    Array.isArray(r.modules) &&
    Array.isArray(r.instruments) &&
    (r.coverageStatus === "no_experiment" || r.modules.length + r.instruments.length > 0);
  return (
    boards.some((b) => b.id === r.board) &&
    grades.includes(r.grade) &&
    subjects.includes(r.subject) &&
    ["chapter", "topic", "objective", "outcome", "edition"].every(
      (k) => typeof r[k] === "string" && r[k].trim() && r[k].length <= 1000
    ) &&
    typeof r.source === "string" &&
    /^https:\/\//.test(r.source) &&
    hasContent &&
    r.modules.every((id) => modules.includes(id)) &&
    r.instruments.every((id) => instruments.includes(id)) &&
    typeof r.enabled === "boolean"
  );
}
