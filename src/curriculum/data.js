import seed from "./seed.json";
import { mergeRecords, sortByTextbookOrder } from "./model.js";
import { firebaseConfigured } from "../firebase.js";

export async function getCurriculum() {
  const upcomingBoards = seed.upcomingBoards || [];
  if (!firebaseConfigured) {
    return {
      ...seed,
      upcomingBoards,
      allBoards: [...seed.boards, ...upcomingBoards],
      mappings: sortByTextbookOrder(seed.mappings),
      cloud: false,
    };
  }
  try {
    const [{ db }, { collection, getDocsFromServer }] = await Promise.all([
      import("../db.js"),
      import("firebase/firestore"),
    ]);
    const [b, m] = await Promise.all(
      ["curriculumBoards", "curriculumMappings"].map((n) => getDocsFromServer(collection(db, n)))
    );
    const boards = mergeRecords(
      seed.boards,
      b.docs.map((d) => ({ ...d.data(), id: d.id }))
    );
    const mappings = sortByTextbookOrder(
      mergeRecords(
        seed.mappings,
        m.docs.map((d) => ({ ...d.data(), id: d.id }))
      )
    );
    return {
      boards,
      upcomingBoards,
      allBoards: [...boards, ...upcomingBoards],
      mappings,
      cloud: true,
    };
  } catch {
    return {
      ...seed,
      upcomingBoards,
      allBoards: [...seed.boards, ...upcomingBoards],
      mappings: sortByTextbookOrder(seed.mappings),
      cloud: false,
    };
  }
}

export async function saveRecord(collectionName, record) {
  const [{ db }, { doc, setDoc }] = await Promise.all([
    import("../db.js"),
    import("firebase/firestore"),
  ]);
  if (!db) throw new Error("Firebase is not configured.");
  const { id, ...data } = record;
  await setDoc(doc(db, collectionName, id), data);
}
