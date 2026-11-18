import {getPartnerPrefs,savePartnerPrefs,initPartnerPreferences} from './preferences.js';
import {getLanguage,setLanguage,languages,t} from '../i18n/config.js';
import {escapeHtml as esc} from '../lib/html.js';
import {getGeminiApiKey,setGeminiApiKey} from './geminiClient.js';
export function mountPartnerSettings() {
  initPartnerPreferences();
  const trigger=document.createElement('button');
  trigger.className='btn partner-settings-trigger';trigger.type='button';trigger.textContent=t('partner.settings');
  const dialog=document.createElement('dialog');dialog.className='partner-settings';dialog.setAttribute('aria-labelledby','partner-settings-title');
  document.body.append(trigger,dialog);
  function paint() {
    const p=getPartnerPrefs();
    const select=(name,values,value)=>`<label>${esc(t('partner.'+name))}<select name="${name}">${values.map(([v,label])=>`<option value="${esc(v)}" ${String(value)===v?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`;
    const check=(name)=>`<label><input type="checkbox" name="${name}" ${p[name]?'checked':''}> ${esc(t('partner.'+name))}</label>`;
    dialog.innerHTML=`<form method="dialog"><h2 id="partner-settings-title">${esc(t('partner.settings'))}</h2>
      ${select('level',['beginner','intermediate','advanced'].map(v=>[v,t('partner.'+v)]),p.level)}
      ${select('language',Object.entries(languages),getLanguage())}
      ${check('voiceEnabled')}
      <label>${esc(t('partner.rate'))}<input name="rate" type="range" min="0.5" max="2" step="0.1" value="${p.rate}"><output>${p.rate}×</output></label>
      <label>${esc(t('partner.voice'))}<select name="voice"></select></label>
      ${select('textSize',['normal','large','xlarge'].map(v=>[v,t('partner.'+v)]),p.textSize)}
      ${check('highContrast')}
      ${select('colorMode',['none','protanopia','deuteranopia','tritanopia'].map(v=>[v,t('partner.'+v)]),p.colorMode)}
      ${check('reducedMotion')}
      <label style="margin-top:1rem;display:block;">
        <strong>Gemini API Key (for Live Web AI):</strong>
        <input type="password" name="geminiApiKey" placeholder="AIzaSy..." value="${esc(getGeminiApiKey())}" style="display:block;width:100%;padding:.5rem;margin-top:.3rem;border:1px solid currentColor;border-radius:6px;background:inherit;color:inherit;font-family:monospace;font-size:14px;">
        <small style="opacity:0.8;display:block;margin-top:3px;">Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:var(--primary,#0f766e);text-decoration:underline;">Google AI Studio</a>. Stored locally in your browser.</small>
      </label>
      <p>${esc(t('partner.voiceNote'))}</p><button class="btn primary" value="close">${esc(t('partner.close'))}</button></form>`;
    voices();
  }
  function voices() {
    const select=dialog.querySelector('[name=voice]');if(!select)return;
    const p=getPartnerPrefs();
    select.replaceChildren(new Option(t('partner.automatic'),''));
    (window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.split('-')[0]===getLanguage().split('-')[0]).forEach(v=>select.add(new Option(`${v.name} (${v.lang}${v.localService?' · '+t('partner.local'):''})`,v.voiceURI)));
    select.value=p.voice;if(select.selectedIndex<0)select.value='';
  }
  trigger.onclick=()=>{paint();dialog.showModal();};
  dialog.addEventListener('change',e=>{
    const el=e.target;if(!el.name)return;
    if(el.name==='geminiApiKey') {setGeminiApiKey(el.value);return;}
    if(el.name==='language') {setLanguage(el.value);return;}
    savePartnerPrefs({[el.name]:el.type==='checkbox'?el.checked:el.name==='rate'?Number(el.value):el.value});
  });
  dialog.addEventListener('input',e=>{if(e.target.name==='rate')e.target.nextElementSibling.textContent=e.target.value+'×';});
  window.speechSynthesis?.addEventListener('voiceschanged',voices);
  document.addEventListener('spark-language',()=>{trigger.textContent=t('partner.settings');if(dialog.open)paint();});
  dialog.addEventListener('close',()=>trigger.focus());
}
