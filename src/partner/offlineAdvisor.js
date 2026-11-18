import { plain } from "./context.js";

/**
 * Generates an intelligent, curriculum-grounded answer when offline or when
 * the remote AI endpoint is unavailable, using the active 3D module's lesson,
 * guidance, safety notes, and live parameter snapshot.
 */
export function answerOffline({ question, module, snapshot, level = "school" }) {
  const q = (question || "").toLowerCase();
  const lessonText = plain(module?.lesson || "").trim();
  const sentences = lessonText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const inputs = (snapshot?.inputs || [])
    .slice(0, 5)
    .map((x) => `${x.label}: ${x.value}`)
    .join(", ");
  const outputs = (snapshot?.outputs || [])
    .slice(0, 5)
    .map((x) => `${x.label}: ${x.value}`)
    .join(", ");

  const guidance = Array.isArray(module?.guidance) ? module.guidance : [];
  const safety = Array.isArray(module?.safety) ? module.safety : [];

  const parts = [];
  parts.push(`⚡ Offline Smart Tutor (${module?.name || "3D Lab"}):`);

  if (q.includes("why") || q.includes("explain") || q.includes("happening")) {
    if (sentences.length) {
      parts.push(sentences.slice(0, 2).join(" "));
    }
    if (inputs || outputs) {
      parts.push(
        `Right now in your simulation${inputs ? ` with ${inputs}` : ""}, the live readout shows ${outputs || "active real-time motion"}.`
      );
    }
  } else if (q.includes("law") || q.includes("formula") || q.includes("principle") || q.includes("rule")) {
    const formulaSentences = sentences.filter((s) =>
      /law|formula|equation|proportional|equal|principle|conservation|ratio|=/i.test(s)
    );
    parts.push(
      (formulaSentences.length ? formulaSentences : sentences).slice(0, 2).join(" ") ||
        `${module?.name} demonstrates core ${module?.subject || "STEM"} relationships.`
    );
  } else if (q.includes("change") || q.includes("increase") || q.includes("decrease") || q.includes("try")) {
    if (guidance.length) {
      parts.push(`Try this experiment step: ${guidance[0]}`);
    } else if (inputs) {
      parts.push(`Adjust one variable at a time (currently ${inputs}) and watch how ${outputs || "the 3D apparatus"} responds.`);
    }
  } else if (q.includes("use") || q.includes("real") || q.includes("life") || q.includes("application")) {
    parts.push(
      sentences.slice(-2).join(" ") ||
        `This ${module?.subject || "STEM"} principle is widely used in engineering, school laboratories, and everyday technology.`
    );
  } else {
    if (sentences.length) parts.push(sentences.slice(0, 2).join(" "));
    if (inputs || outputs) {
      parts.push(`Live state — ${[inputs, outputs].filter(Boolean).join(" | ")}.`);
    }
    if (guidance.length) parts.push(`Tip: ${guidance[0]}`);
  }

  if (safety.length && (q.includes("safe") || q.includes("care") || level === "beginner")) {
    parts.push(`Safety note: ${safety[0]}`);
  }

  return parts.join("\n\n");
}
