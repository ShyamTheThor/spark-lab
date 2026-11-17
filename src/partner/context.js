import {prefersReducedMotion} from "./preferences.js";
import {getLanguage} from '../i18n/config.js';
import {getStudentPrefs} from '../curriculum/preferences.js';
export function plain(html) {const d=document.createElement('div');d.innerHTML=html||'';return d.textContent.replace(/\s+/g,' ').trim();}
const clean = (s,n=600) => String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
// Read the actual rendered deterministic results. Never scrape quiz examples or page-wide student data.
export function snapshotExperiment(module,panel) {
  const p=getStudentPrefs();
  const inputs=[...panel.querySelectorAll('input:not([type=button]):not([type=submit]),select,textarea')].slice(0,80).map(el=>({
    label:clean(el.labels?.[0]?.textContent||el.getAttribute('aria-label')||el.id||el.name,160),
    value:clean(el.type==='checkbox'?String(el.checked):el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:el.value)
  }));
  const outputs=[...panel.querySelectorAll('output,.stat-grid>div,.formula,.fact,[role=status]')].slice(0,100).map(el=>({label:clean(el.querySelector('dt')?.textContent||el.id||'Displayed result',160),value:clean(el.querySelector("dd")?.textContent||el.textContent)})).filter(x=>x.value);
  const state=module.getExperimentState?.()??null;
  return {id:module.id,title:module.name,subject:module.subject,topic:module.tag,grade:Number(p.grade)||10,board:p.board||'ncert',language:getLanguage(),
    inputs,outputs,state,formulas:clean([...panel.querySelectorAll('.formula')].map(e=>e.textContent).join('; '),2500),
    lesson:plain((module.blurb||'')+' '+module.lesson).slice(0,7000),status:prefersReducedMotion()?'Motion frozen by accessibility preference':state?.status||'Live rendered simulation; running status unavailable',source:'simulation',capturedAt:Date.now()};
}
