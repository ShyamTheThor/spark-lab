const ASSIGNMENTS_KEY = "sparklab.teacher.assignments.v1";
const SUBMISSIONS_KEY = "sparklab.teacher.submissions.v1";
const OFFLINE_QUEUE_KEY = "sparklab.offline.queue.v1";
const DEMO_TEACHER_KEY = "sparklab.teacher.demo.session";

export const DEFAULT_ASSIGNMENTS = [
  {
    id: "ASG-101",
    title: "Verify Snell's Law with Crown Glass Prism",
    moduleId: "refraction",
    moduleName: "Refraction & Snell's Law",
    subject: "physics",
    grade: "10",
    section: "A",
    dueDate: "2026-11-25",
    instructions:
      "Record 4 different angles of incidence (30°, 45°, 60°, 75°), calculate n = sin(i)/sin(r), and submit the 3D snapshot report.",
    submissionsCount: 28,
    totalStudents: 36,
  },
  {
    id: "ASG-102",
    title: "Simple Pendulum: Length vs Time Period (T² ∝ L)",
    moduleId: "pendulum",
    moduleName: "Simple Pendulum",
    subject: "physics",
    grade: "9",
    section: "B",
    dueDate: "2026-11-28",
    instructions:
      "Measure time period T for lengths 0.5m, 1.0m, 1.5m and 2.0m. Export the lab report with your observation table.",
    submissionsCount: 32,
    totalStudents: 35,
  },
  {
    id: "ASG-103",
    title: "Ohm's Law: Resistance Verification",
    moduleId: "circuit",
    moduleName: "Ohm's Law Virtual Circuit",
    subject: "physics",
    grade: "10",
    section: "A",
    dueDate: "2026-12-02",
    instructions:
      "Adjust voltage between 2V and 12V. Plot V vs I to calculate effective circuit resistance.",
    submissionsCount: 14,
    totalStudents: 36,
  },
];

export const DEFAULT_SUBMISSIONS = [
  {
    id: "SUB-801",
    assignmentId: "ASG-101",
    studentName: "Aarav Sharma",
    rollNo: "10-A-04",
    grade: "Class 10 - Section A",
    moduleId: "refraction",
    moduleName: "Refraction & Snell's Law",
    submittedAt: "17 Nov 2026, 04:30 PM",
    snapshotUrl: "",
    observations: [
      { name: "Incident Angle (i)", value: "45°" },
      { name: "Refracted Angle (r)", value: "28.1°" },
      { name: "Medium 1", value: "Air (n=1.00)" },
      { name: "Medium 2", value: "Crown Glass (n=1.52)" },
      { name: "Calculated Ratio sin(i)/sin(r)", value: "1.503" },
    ],
    studentConclusion:
      "Observed that light bends towards the normal when entering glass. Snell's ratio remained constant within 1% experimental tolerance.",
    quizScore: "3/3 (100%)",
    quizPct: 100,
    status: "Needs Review",
    gradeScore: "",
    teacherRemark: "",
  },
  {
    id: "SUB-802",
    assignmentId: "ASG-102",
    studentName: "Diya Patel",
    rollNo: "09-B-12",
    grade: "Class 9 - Section B",
    moduleId: "pendulum",
    moduleName: "Simple Pendulum",
    submittedAt: "17 Nov 2026, 06:15 PM",
    snapshotUrl: "",
    observations: [
      { name: "String Length (L)", value: "1.0 m" },
      { name: "Bob Mass", value: "0.2 kg" },
      { name: "Initial Angle", value: "10°" },
      { name: "Measured Period (T)", value: "2.01 s" },
    ],
    studentConclusion:
      "The time period is proportional to the square root of string length and independent of bob mass.",
    quizScore: "2/2 (100%)",
    quizPct: 100,
    status: "Graded",
    gradeScore: "A+",
    teacherRemark: "Excellent observation table and clear scientific conclusion!",
  },
  {
    id: "SUB-803",
    assignmentId: "ASG-101",
    studentName: "Rohan Verma",
    rollNo: "10-A-21",
    grade: "Class 10 - Section A",
    moduleId: "refraction",
    moduleName: "Refraction & Snell's Law",
    submittedAt: "18 Nov 2026, 03:10 AM",
    snapshotUrl: "",
    observations: [
      { name: "Incident Angle (i)", value: "60°" },
      { name: "Refracted Angle (r)", value: "35.2°" },
      { name: "Medium 1", value: "Air" },
      { name: "Medium 2", value: "Dense Flint Glass" },
    ],
    studentConclusion:
      "Higher refractive index results in greater deviation toward normal.",
    quizScore: "2/3 (67%)",
    quizPct: 67,
    status: "Needs Review",
    gradeScore: "",
    teacherRemark: "",
  },
];

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadAssignments() {
  return safeRead(ASSIGNMENTS_KEY, DEFAULT_ASSIGNMENTS.map((a) => ({ ...a })));
}

export function saveAssignments(list) {
  safeWrite(ASSIGNMENTS_KEY, list);
  dispatchEvent(new CustomEvent("spark-classroom-update"));
}

export function loadSubmissions() {
  return safeRead(SUBMISSIONS_KEY, DEFAULT_SUBMISSIONS.map((s) => ({ ...s })));
}

export function saveSubmissions(list) {
  safeWrite(SUBMISSIONS_KEY, list);
  dispatchEvent(new CustomEvent("spark-classroom-update"));
}

export function getAssignmentsForModule(moduleId) {
  if (!moduleId) return [];
  return loadAssignments().filter((a) => a.moduleId === moduleId);
}

export function getOfflineQueue() {
  return safeRead(OFFLINE_QUEUE_KEY, []);
}

export function queueOfflineAction(action) {
  const queue = getOfflineQueue();
  queue.push({
    ...action,
    queuedAt: new Date().toISOString(),
  });
  safeWrite(OFFLINE_QUEUE_KEY, queue);
  dispatchEvent(new CustomEvent("spark-classroom-update"));
}

export function flushOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const queue = getOfflineQueue();
  if (!queue.length) return 0;
  safeWrite(OFFLINE_QUEUE_KEY, []);
  dispatchEvent(new CustomEvent("spark-classroom-update"));
  return queue.length;
}

export function submitLabReport({
  assignmentId = "",
  studentName,
  rollNo = "",
  grade = "Class 10 - Section A",
  moduleId,
  moduleName,
  snapshotUrl = "",
  observations = [],
  studentConclusion = "",
  quizScore = "Not Attempted",
  quizPct = null,
}) {
  const submissions = loadSubmissions();
  const now = new Date();
  const submittedAt = now.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const entry = {
    id: `SUB-${Math.floor(1000 + Math.random() * 9000)}`,
    assignmentId: assignmentId || "",
    studentName: (studentName || "Student Scholar").trim(),
    rollNo: (rollNo || "LAB-01").trim(),
    grade: (grade || "Class 10 - Section A").trim(),
    moduleId: moduleId || "",
    moduleName: moduleName || "Virtual Experiment",
    submittedAt,
    snapshotUrl: snapshotUrl || "",
    observations: Array.isArray(observations) ? observations : [],
    studentConclusion: (studentConclusion || "").trim(),
    quizScore,
    quizPct,
    status: "Needs Review",
    gradeScore: "",
    teacherRemark: "",
    offlineSaved: typeof navigator !== "undefined" ? !navigator.onLine : false,
  };

  submissions.unshift(entry);
  saveSubmissions(submissions);

  if (assignmentId) {
    const assignments = loadAssignments();
    const idx = assignments.findIndex((a) => a.id === assignmentId);
    if (idx >= 0) {
      assignments[idx] = {
        ...assignments[idx],
        submissionsCount: Math.min(
          assignments[idx].totalStudents || 36,
          (assignments[idx].submissionsCount || 0) + 1
        ),
      };
      saveAssignments(assignments);
    }
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    queueOfflineAction({ type: "lab_submission", id: entry.id, moduleId });
  }

  return entry;
}

export function exportClassroomBundle() {
  return {
    app: "SparkLab",
    exportedAt: new Date().toISOString(),
    version: 1,
    assignments: loadAssignments(),
    submissions: loadSubmissions(),
  };
}

export function importClassroomBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("Invalid classroom bundle file.");
  }
  let addedAsg = 0;
  let addedSub = 0;

  if (Array.isArray(bundle.assignments)) {
    const existing = loadAssignments();
    const byId = new Map(existing.map((a) => [a.id, a]));
    for (const a of bundle.assignments) {
      if (a && a.id && a.title && !byId.has(a.id)) {
        byId.set(a.id, a);
        addedAsg++;
      }
    }
    saveAssignments([...byId.values()]);
  }

  if (Array.isArray(bundle.submissions)) {
    const existing = loadSubmissions();
    const byId = new Map(existing.map((s) => [s.id, s]));
    for (const s of bundle.submissions) {
      if (s && s.id && s.studentName && !byId.has(s.id)) {
        byId.set(s.id, s);
        addedSub++;
      }
    }
    saveSubmissions([...byId.values()]);
  }

  return { addedAsg, addedSub };
}

export function exportSubmissionsCSV(submissions) {
  const escCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Submission ID",
    "Student Name",
    "Roll No",
    "Class",
    "Experiment",
    "Submitted At",
    "Quiz Score",
    "Status",
    "Grade",
    "Teacher Remark",
  ];
  const rows = (submissions || []).map((s) =>
    [
      s.id,
      s.studentName,
      s.rollNo,
      s.grade,
      s.moduleName,
      s.submittedAt,
      s.quizScore,
      s.status,
      s.gradeScore,
      s.teacherRemark,
    ]
      .map(escCsv)
      .join(",")
  );
  return [header.map(escCsv).join(","), ...rows].join("\n");
}

export function getDemoTeacherUser() {
  try {
    const raw = localStorage.getItem(DEMO_TEACHER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function enableDemoTeacherSession() {
  const demoUser = {
    uid: "demo-educator-2026",
    displayName: "Prof. Ananya Sharma (Demo)",
    email: "ananya.teacher@kv.edu",
    isDemo: true,
  };
  try {
    localStorage.setItem(DEMO_TEACHER_KEY, JSON.stringify(demoUser));
  } catch {}
  return demoUser;
}

export function clearDemoTeacherSession() {
  try {
    localStorage.removeItem(DEMO_TEACHER_KEY);
  } catch {}
}

const ROLE_KEY = "sparklab.auth.role";

export function getLoginRole() {
  try {
    return localStorage.getItem(ROLE_KEY) || null;
  } catch {
    return null;
  }
}

export function setLoginRole(role) {
  try {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  } catch {}
  dispatchEvent(new CustomEvent("spark-role-change", { detail: role || null }));
}

export function clearLoginRole() {
  setLoginRole(null);
}


const LIVE_QUIZ_KEY = "sparklab.live.quiz.v1";

function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function getLiveQuizFirestore() {
  try {
    const [{ firebaseConfigured }, { db }, fs] = await Promise.all([
      import("../firebase.js"),
      import("../db.js"),
      import("firebase/firestore"),
    ]);
    if (!firebaseConfigured || !db || !navigator.onLine) return null;
    return { db, ...fs };
  } catch {
    return null;
  }
}

export function loadLiveQuizSession() {
  return safeRead(LIVE_QUIZ_KEY, null);
}

export function saveLiveQuizSession(session, { syncCloud = true } = {}) {
  if (!session) {
    try {
      localStorage.removeItem(LIVE_QUIZ_KEY);
    } catch {}
  } else {
    safeWrite(LIVE_QUIZ_KEY, session);
    if (syncCloud && session.code) {
      getLiveQuizFirestore().then((fs) => {
        if (!fs) return;
        const clean = sanitizeForFirestore({ ...session, updatedAt: Date.now() });
        fs.setDoc(fs.doc(fs.db, "liveQuizzes", String(session.code)), clean, { merge: true }).catch(
          () => {}
        );
      });
    }
  }
  dispatchEvent(new CustomEvent("spark-classroom-update"));
}

export function subscribeLiveQuizRoom(code, onUpdate) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode) return () => {};
  let unsubFirestore = null;
  let cancelled = false;

  getLiveQuizFirestore().then((fs) => {
    if (!fs || cancelled) return;
    unsubFirestore = fs.onSnapshot(
      fs.doc(fs.db, "liveQuizzes", cleanCode),
      (snap) => {
        if (!snap.exists() || cancelled) return;
        const remote = snap.data();
        if (!remote?.code) return;
        safeWrite(LIVE_QUIZ_KEY, remote);
        dispatchEvent(new CustomEvent("spark-classroom-update"));
        onUpdate?.(remote);
      },
      () => {}
    );
  });

  return () => {
    cancelled = true;
    unsubFirestore?.();
  };
}

export async function createLiveQuizSession({
  title = "Live STEM Quiz",
  moduleId = "",
  subject = "STEM",
  questions = [],
  timePerQuestion = 20,
  hostName = "Teacher",
}) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const session = {
    code,
    title,
    moduleId,
    subject,
    hostName,
    timePerQuestion,
    status: "lobby", // 'lobby' | 'active' | 'ended'
    currentIndex: 0,
    questionStartedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions: Array.isArray(questions) ? questions : [],
    participants: {},
  };
  safeWrite(LIVE_QUIZ_KEY, session);
  const fs = await getLiveQuizFirestore();
  if (fs) {
    try {
      await fs.setDoc(fs.doc(fs.db, "liveQuizzes", code), sanitizeForFirestore(session));
    } catch {}
  }
  dispatchEvent(new CustomEvent("spark-classroom-update"));
  return session;
}

export async function joinLiveQuizParticipant(code, studentName) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode) return null;

  let session = null;
  const fs = await getLiveQuizFirestore();
  if (fs) {
    try {
      const snap = await fs.getDoc(fs.doc(fs.db, "liveQuizzes", cleanCode));
      if (snap.exists()) {
        session = snap.data();
      }
    } catch {}
  }
  if (!session) {
    const local = loadLiveQuizSession();
    if (local && String(local.code).trim() === cleanCode) {
      session = local;
    }
  }
  if (!session || session.status === "ended") return null;

  const cleanName = (studentName || "Student").trim();
  const existing = Object.values(session.participants || {}).find(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    saveLiveQuizSession(session, { syncCloud: false });
    return { session, participantId: existing.id };
  }

  const participantId = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
  const participantData = {
    id: participantId,
    name: cleanName,
    score: 0,
    streak: 0,
    answers: {},
    joinedAt: Date.now(),
  };
  session.participants = { ...(session.participants || {}), [participantId]: participantData };
  session.updatedAt = Date.now();
  safeWrite(LIVE_QUIZ_KEY, session);

  if (fs) {
    try {
      await fs.setDoc(
        fs.doc(fs.db, "liveQuizzes", cleanCode),
        sanitizeForFirestore({
          updatedAt: Date.now(),
          participants: { [participantId]: participantData },
        }),
        { merge: true }
      );
    } catch {}
  }
  dispatchEvent(new CustomEvent("spark-classroom-update"));
  return { session, participantId };
}

export async function submitLiveQuizAnswer(
  participantId,
  questionIndex,
  choiceIndex,
  isCorrect,
  timeLeft = 10,
  totalTime = 20,
  roomCode = null
) {
  const cleanCode = String(roomCode || loadLiveQuizSession()?.code || "").trim();
  const fs = await getLiveQuizFirestore();

  let session = loadLiveQuizSession();
  if (fs && cleanCode) {
    try {
      const snap = await fs.getDoc(fs.doc(fs.db, "liveQuizzes", cleanCode));
      if (snap.exists()) session = snap.data();
    } catch {}
  }

  if (!session || !session.participants?.[participantId]) return null;
  const p = session.participants[participantId];
  if (p.answers?.[questionIndex] !== undefined) return session;

  let points = 0;
  if (isCorrect) {
    p.streak = (p.streak || 0) + 1;
    const ratio = Math.max(0, Math.min(1, timeLeft / Math.max(1, totalTime)));
    points = 500 + Math.round(ratio * 500) + p.streak * 50;
    p.score = (p.score || 0) + points;
  } else {
    p.streak = 0;
  }

  p.answers = {
    ...(p.answers || {}),
    [questionIndex]: {
      choiceIndex,
      isCorrect: !!isCorrect,
      points,
      answeredAt: Date.now(),
    },
  };
  session.updatedAt = Date.now();
  safeWrite(LIVE_QUIZ_KEY, session);

  if (fs && cleanCode) {
    try {
      await fs.setDoc(
        fs.doc(fs.db, "liveQuizzes", cleanCode),
        sanitizeForFirestore({
          updatedAt: Date.now(),
          participants: {
            [participantId]: p,
          },
        }),
        { merge: true }
      );
    } catch {}
  }
  dispatchEvent(new CustomEvent("spark-classroom-update"));
  return session;
}
