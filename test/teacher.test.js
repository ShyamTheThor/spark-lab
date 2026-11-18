// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  isTeacher,
  verifyTeacherCode,
  revokeTeacherAccess,
  mount,
  TEACHER_ACCESS_CODE,
} from "../src/features/teacher.js";

beforeEach(() => {
  document.body.innerHTML = '<main id="main"></main>';
  localStorage.clear();
});

afterEach(() => {
  revokeTeacherAccess();
  document.body.innerHTML = "";
});

it("denies teacher access when no user is logged in", () => {
  expect(isTeacher(null)).toBe(false);
});

it("identifies users with educator emails as teachers", () => {
  expect(isTeacher({ email: "sharma.teacher@kv.edu" })).toBe(true);
  expect(isTeacher({ email: "faculty.physics@school.org" })).toBe(true);
  expect(isTeacher({ email: "student123@gmail.com" })).toBe(false);
});

it("verifies teacher access code correctly", () => {
  const user = { uid: "user-456", email: "user@example.com" };

  // Fails with invalid passcode
  const failRes = verifyTeacherCode(user, "WRONG-CODE");
  expect(failRes.success).toBe(false);
  expect(isTeacher(user)).toBe(false);

  // Succeeds with valid passcode
  const succRes = verifyTeacherCode(user, TEACHER_ACCESS_CODE);
  expect(succRes.success).toBe(true);
  expect(isTeacher(user)).toBe(true);

  // Revoking clears access
  revokeTeacherAccess();
  expect(isTeacher(user)).toBe(false);
});

it("mounts access gate when unauthenticated or unverified", async () => {
  const root = document.getElementById("main");
  await mount(root);

  expect(root.querySelector(".teacher-gate-card")).not.toBeNull();
  expect(root.querySelector(".gate-title").textContent).toContain("Teacher Portal");
});
