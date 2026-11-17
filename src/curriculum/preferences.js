import { readState, saveItem } from "../features/store.js";

const PREF_KEY = "sparklab.curriculum.pref.v1";

const DEFAULT_PREF = {
  board: "ncert",
  grade: 10,
  subject: "Science",
  mode: "guided", // "guided" | "explore"
  lastChapterId: "",
  bookmarks: [],
};

export function getStudentPrefs() {
  try {
    const stored = readState().preferences?.curriculum;
    if (stored && typeof stored === "object") {
      return { ...DEFAULT_PREF, ...stored };
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { ...DEFAULT_PREF, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREF };
}

export function updateStudentPrefs(patch) {
  const next = { ...getStudentPrefs(), ...patch };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    saveItem("preferences", "curriculum", next);
  } catch {
    /* ignore */
  }
  return next;
}

export function toggleBookmark(chapterId) {
  const prefs = getStudentPrefs();
  const set = new Set(prefs.bookmarks || []);
  if (set.has(chapterId)) set.delete(chapterId);
  else set.add(chapterId);
  return updateStudentPrefs({ bookmarks: [...set] });
}

export function isBookmarked(chapterId) {
  return (getStudentPrefs().bookmarks || []).includes(chapterId);
}
