import {mountVoiceGuide} from "../partner/voice.js";

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
  if(!root)return ()=>{};
  const guide=mountVoiceGuide(root,()=>[getText()]);
  return ()=>guide.dispose();
}
