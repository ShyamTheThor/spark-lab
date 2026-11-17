import {readState, saveItem, subscribe} from '../features/store.js';
export const defaults = {level:'beginner', voiceEnabled:true, rate:1, voice:'', textSize:'normal', highContrast:false, colorMode:'none', reducedMotion:false};
export function getPartnerPrefs() {
  const p = {...defaults,...readState().preferences.labPartner};
  return {...p, level:['beginner','intermediate','advanced'].includes(p.level)?p.level:'beginner',
    rate:Math.max(0.5,Math.min(2,Number(p.rate)||1)),
    textSize:['normal','large','xlarge'].includes(p.textSize)?p.textSize:'normal',
    colorMode:['none','protanopia','deuteranopia','tritanopia'].includes(p.colorMode)?p.colorMode:'none'};
}
export const savePartnerPrefs = patch => saveItem('preferences','labPartner',{...getPartnerPrefs(),...patch});
let reduced=false;
export function initPartnerPreferences() {
  let previous="";
  function apply() {
    const p=getPartnerPrefs(), r=document.documentElement;
    const serialized=JSON.stringify(p);if(serialized===previous)return;previous=serialized;
    reduced=!!p.reducedMotion;
    r.dataset.textSize=p.textSize;
    if(p.highContrast) r.dataset.contrast='high'; else r.removeAttribute('data-contrast');
    r.dataset.colorMode=p.colorMode;
    r.dataset.reducedMotion=String(p.reducedMotion);
    document.dispatchEvent(new CustomEvent('spark-accessibility',{detail:p}));
  }
  // Migrate existing local accessibility choices once.
  if(!readState().preferences.labPartner) {
    let old={}; try {old={textSize:localStorage.getItem('sparklab.textSize')||'normal',highContrast:localStorage.getItem('sparklab.contrast')==='high'};} catch { /* optional storage */ }
    savePartnerPrefs(old);
  }
  apply();
  return subscribe(apply);
}
export const prefersReducedMotion = () => reduced || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
