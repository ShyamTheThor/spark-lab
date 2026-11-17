import {getLanguage,t} from '../i18n/config.js';
import {translateText} from '../i18n/translation.js';
import {getPartnerPrefs} from './preferences.js';
import {escapeHtml as esc} from '../lib/html.js';
export function selectVoice(voices,language,preferred,offline) {
  const matches=voices.filter(v=>v.lang.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase()&&(!offline||v.localService));
  return matches.find(v=>v.voiceURI===preferred)||matches.find(v=>v.localService)||matches[0]||null;
}
export function mountVoiceGuide(root,getSections) {
  const synth=window.speechSynthesis;
  let generation=0, segments=[], index=0, alive=true, utterance=null, state='idle';
  root.innerHTML=`<details class="voice-guide"><summary>${esc(t('partner.voiceGuide'))}</summary>
    <div class="btn-row">${['play','pause','resume','repeat','stop'].map(a=>`<button type="button" class="btn" data-voice="${a}">${esc(t('partner.'+a))}</button>`).join('')}</div>
    <p class="voice-status" role="status"></p><ol class="voice-transcript"></ol></details>`;
  const status=root.querySelector('.voice-status'),list=root.querySelector('ol');
  const buttons=Object.fromEntries([...root.querySelectorAll('[data-voice]')].map(b=>[b.dataset.voice,b]));
  function controls() {buttons.pause.disabled=state!=='speaking';buttons.resume.disabled=state!=='paused';buttons.repeat.disabled=!segments.length||!synth||!getPartnerPrefs().voiceEnabled;buttons.stop.disabled=state==='idle';buttons.play.disabled=!synth||!getPartnerPrefs().voiceEnabled;}
  function stop() {generation++;state='idle';if(utterance){utterance.onend=null;utterance.onerror=null;}synth?.cancel();utterance=null;list.querySelectorAll('[aria-current]').forEach(e=>e.removeAttribute('aria-current'));controls();}
  function speak(token) {
    if(!alive||token!==generation)return;
    if(!synth){status.textContent=t('partner.noVoice');return;}
    if(index>=segments.length){state='idle';controls();return;}
    const p=getPartnerPrefs();
    const voice=selectVoice(synth.getVoices(),getLanguage(),p.voice,!navigator.onLine);
    if(!voice){state='idle';status.textContent=t('partner.noVoice');controls();return;}
    list.querySelectorAll('li').forEach((li,i)=>{if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    utterance=new SpeechSynthesisUtterance(segments[index]);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=p.rate;
    utterance.onend=()=>{index++;speak(token);};
    utterance.onerror=()=>{if(token!==generation)return;state='idle';status.textContent=t('partner.noVoice');controls();};
    state='speaking';controls();synth.speak(utterance);
  }
  async function play(sections=getSections(),alreadyTranslated=false) {
    stop();const token=generation;
    segments=[];list.replaceChildren();
    const source=sections.filter(Boolean).flatMap(s=>String(s).split(/(?<=[.!?])\s+/)).flatMap(s=>s.match(/[\s\S]{1,450}(?:\s|$)|[\s\S]{1,450}/g)||[]);
    source.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});
    if(!getPartnerPrefs().voiceEnabled){status.textContent=t('partner.voiceDisabled');return;}
    status.textContent=t('partner.loading');
    try {
      const texts=alreadyTranslated?source:await Promise.all(source.map(async text=>{
        const r=await translateText(text,getLanguage(),{allowNetwork:navigator.onLine});
        if(!r.text)throw new Error('No translation');return r.text;
      }));
      if(!alive||token!==generation)return;
      segments=texts;list.replaceChildren();list.lang=getLanguage();
      texts.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});
      status.textContent=t('partner.voiceNote');index=0;
      if(!synth){status.textContent=t('partner.noVoice');return;}
      speak(token);
    } catch {if(alive&&token===generation)status.textContent=t('partner.noTranslation');}
  }
  buttons.play.onclick=()=>play();buttons.pause.onclick=()=>{synth.pause();state='paused';controls();};buttons.resume.onclick=()=>{synth.resume();state='speaking';controls();};
  buttons.stop.onclick=()=>{stop();status.textContent='';};
  buttons.repeat.onclick=()=>{const i=Math.min(index,segments.length-1);stop();index=i;speak(generation);};
  const prefChange=()=>{if(!getPartnerPrefs().voiceEnabled)stop();controls();};
  document.addEventListener('spark-accessibility',prefChange);
  document.addEventListener('spark-language',stop);
  controls();if(!synth)status.textContent=t('partner.noVoice');
  // Text instructions are always available, including offline with no voice installed.
  getSections().filter(Boolean).forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});
  return {read:play,dispose(){alive=false;stop();document.removeEventListener('spark-accessibility',prefChange);document.removeEventListener('spark-language',stop);}};
}
