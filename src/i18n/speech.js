import { getLanguage, t } from "./config.js";

const LANG_TAGS = {
  en: ["en-IN", "en-GB", "en-US", "en"],
  hi: ["hi-IN", "hi"],
  kn: ["kn-IN", "kn"],
  ta: ["ta-IN", "ta"],
  te: ["te-IN", "te"],
  ml: ["ml-IN", "ml"],
  mr: ["mr-IN", "mr"],
  bn: ["bn-IN", "bn-BD", "bn"],
};

export function findVoice(lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const tags = LANG_TAGS[lang] || [lang];
  for (const tag of tags) {
    const exact = voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
  }
  for (const tag of tags) {
    const prefix = tag.split("-")[0].toLowerCase();
    const partial = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (partial) return partial;
  }
  return null;
}

export function mountAudioControls(root, getText) {
  if (!root) return () => {};
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  root.innerHTML = `
    <div class="audio-bar" role="region" aria-label="${t("chapterView.listenAudio")}">
      <button class="btn" type="button" data-audio="play">🔊 ${t("chapterView.listenAudio")}</button>
      <button class="btn" type="button" data-audio="pause" hidden>${t("chapterView.pauseAudio")}</button>
      <button class="btn" type="button" data-audio="resume" hidden>${t("chapterView.resumeAudio")}</button>
      <button class="btn" type="button" data-audio="stop" hidden>${t("chapterView.stopAudio")}</button>
      <span class="fact audio-status" role="status"></span>
    </div>
  `;
  const playBtn = root.querySelector('[data-audio="play"]');
  const pauseBtn = root.querySelector('[data-audio="pause"]');
  const resumeBtn = root.querySelector('[data-audio="resume"]');
  const stopBtn = root.querySelector('[data-audio="stop"]');
  const statusEl = root.querySelector(".audio-status");

  if (!supported) {
    playBtn.disabled = true;
    statusEl.textContent = t("chapterView.audioUnavailable");
    return () => {};
  }

  function resetButtons() {
    playBtn.hidden = false;
    pauseBtn.hidden = true;
    resumeBtn.hidden = true;
    stopBtn.hidden = true;
  }

  playBtn.onclick = () => {
    const text = (getText() || "").trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const lang = getLanguage();
    const voice = findVoice(lang);
    const utt = new SpeechSynthesisUtterance(text.slice(0, 3000));
    utt.lang = (LANG_TAGS[lang] || [lang])[0];
    if (voice) {
      utt.voice = voice;
      statusEl.textContent = "";
    } else {
      statusEl.textContent = t("chapterView.audioUnavailable");
    }
    utt.onend = resetButtons;
    utt.onerror = resetButtons;
    playBtn.hidden = true;
    pauseBtn.hidden = false;
    stopBtn.hidden = false;
    window.speechSynthesis.speak(utt);
  };

  pauseBtn.onclick = () => {
    window.speechSynthesis.pause();
    pauseBtn.hidden = true;
    resumeBtn.hidden = false;
  };
  resumeBtn.onclick = () => {
    window.speechSynthesis.resume();
    resumeBtn.hidden = true;
    pauseBtn.hidden = false;
  };
  stopBtn.onclick = () => {
    window.speechSynthesis.cancel();
    resetButtons();
  };

  return () => {
    window.speechSynthesis.cancel();
  };
}
