import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, authReady, firebaseConfigured } from "./firebase.js";

const FRIENDLY = {
  "auth/email-already-in-use": "That email already has an account — try signing in instead.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/weak-password": "Password needs to be at least 6 characters.",
  "auth/wrong-password": "Wrong password.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "No account found with that email.",
  "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
  "auth/popup-closed-by-user": "Sign-in was closed before finishing.",
  "auth/popup-blocked": "Sign-in popup was blocked by your browser. Please allow popups for localhost.",
  "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method and enable Google.",
  "auth/unauthorized-domain": "This domain is not authorized in Firebase. Add localhost to Firebase Console > Authentication > Settings > Authorized domains.",
  "auth/network-request-failed": "Network error — check your connection.",
};

function friendly(err) {
  return FRIENDLY[err?.code] || err?.message || "Something went wrong.";
}

export async function syncUserRoleProfile(user, explicitRole = null) {
  if (!user?.uid || user.isDemo) return explicitRole || null;
  if (!firebaseConfigured || !navigator.onLine) return explicitRole || null;
  try {
    const [{ db }, { doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
      import("./db.js"),
      import("firebase/firestore"),
    ]);
    if (!db) return explicitRole || null;
    const ref = doc(db, "users", user.uid);
    if (explicitRole === "teacher" || explicitRole === "student") {
      await setDoc(
        ref,
        {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          role: explicitRole,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return explicitRole;
    }
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const role = snap.data()?.role;
      if (role === "teacher" || role === "student") return role;
    }
  } catch {
    /* ignore network/rules errors when offline */
  }
  return explicitRole || null;
}

export async function signUp(name, email, password) {
  try {
    if (!auth)
      throw new Error("Cloud accounts are not configured yet. Local learning is available.");
    await authReady;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    return { user: cred.user };
  } catch (err) {
    return { error: friendly(err) };
  }
}

export async function signIn(email, password) {
  try {
    if (!auth)
      throw new Error("Cloud accounts are not configured yet. Local learning is available.");
    await authReady;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  } catch (err) {
    return { error: friendly(err) };
  }
}

export async function signInGoogle() {
  try {
    if (!auth)
      throw new Error("Cloud accounts are not configured yet. Local learning is available.");
    await authReady;
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    return { user: cred.user };
  } catch (err) {
    return { error: friendly(err) };
  }
}

export function signOutUser() {
  return auth ? signOut(auth) : Promise.resolve();
}

export function onAuth(cb) {
  if (!auth) {
    queueMicrotask(() => cb(null));
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}
