import {snapshotExperiment,plain} from './context.js';
import {getPartnerPrefs} from './preferences.js';
import {mountVoiceGuide} from './voice.js';
import {answerOffline} from './offlineAdvisor.js';
import {t,getLanguage} from '../i18n/config.js';
import {escapeHtml as esc} from '../lib/html.js';
import {getGeminiApiKey, setGeminiApiKey, callGeminiDirect} from './geminiClient.js';
export function mountLabPartner(module,panel,host) {
  const block=document.createElement('section');block.className='partner-tools';
  panel.after(block);
  const floating=document.createElement('button');floating.type='button';floating.className='btn primary partner-fab';floating.textContent=t('partner.title');
  const dialog=document.createElement('dialog');dialog.className='partner-chat';dialog.setAttribute('aria-labelledby','partner-title');
  host.append(floating,dialog);
  let history=[],request=null,alive=true,lastAnswer='',lastLanguage=getLanguage(),voice=null;
  const sections=()=>[module.name,plain(module.lesson),...(module.guidance||[]),...(!module.guidance?[...panel.querySelectorAll('label')].map(el=>`${t('partner.adjust')} ${el.textContent}.`):[]),...(module.safety||[])];
  const context=()=>snapshotExperiment(module,panel);
  function drawTools() {
    voice?.dispose();
    block.innerHTML=`<div class="btn-row"><button class="btn" data-explain>${esc(t('partner.explain'))}</button><button class="btn" data-read>${esc(t('partner.readResults'))}</button></div>
      <details><summary>${esc(t('partner.liveData'))}</summary><p>${esc(t('partner.simulated'))}</p><pre class="partner-snapshot" tabindex="0"></pre></details><div class="partner-voice"></div>`;
    block.querySelector('[data-explain]').onclick=()=>{open();ask(t('partner.explainPrompt'));};
    voice=mountVoiceGuide(block.querySelector('.partner-voice'),sections);
    block.querySelector('[data-read]').onclick=()=>{block.querySelector('.voice-guide').open=true;voice.read(context().outputs.map(o=>o.value));};
    refresh();
  }
  function refresh(){if(!alive)return;const c=context();block.querySelector('.partner-snapshot').textContent=[...c.inputs,...c.outputs].map(x=>`${x.label}: ${x.value}`).join('\n')+(c.state?'\n'+JSON.stringify(c.state,null,2):'');}
  function drawChat(){
    dialog.innerHTML=`<header><h2 id="partner-title">${esc(t('partner.title'))}</h2><button class="btn" data-close>${esc(t('partner.close'))}</button></header>
      <p>${esc(module.name)} · ${esc(t('partner.simulated'))}</p><p class="fact">${esc(t('partner.privacy'))}</p>
      <div class="partner-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <p class="partner-error" role="alert"></p>
      <div class="partner-suggestions">${['why','explainQuestion','change','law','uses'].map(k=>`<button class="chip" data-question="${k}">${esc(t('partner.'+k))}</button>`).join('')}</div>
      <form><label for="partner-question">${esc(t('partner.question'))}</label><textarea id="partner-question" maxlength="1500" rows="3" required></textarea><div class="btn-row"><button class="btn primary" type="submit">${esc(t('partner.send'))}</button><button class="btn" type="button" data-cancel>${esc(t('partner.cancel'))}</button><button class="btn" type="button" data-clear>${esc(t('partner.clear'))}</button><button class="btn" type="button" data-speak>${esc(t('partner.readAnswer'))}</button></div></form>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-clear]').onclick=()=>{request?.abort();request=null;history=[];lastAnswer='';dialog.querySelector('.partner-messages').replaceChildren();dialog.querySelector('.partner-error').textContent='';busy(false);};
    dialog.querySelector('[data-cancel]').onclick=()=>request?.abort();
    dialog.querySelector('[data-speak]').onclick=()=>{dialog.close();block.querySelector('.voice-guide').open=true;voice.read([lastAnswer],true);};
    dialog.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>ask(t('partner.'+b.dataset.question)));
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();ask(dialog.querySelector('textarea').value);};
    history.forEach(m=>message(m.role,m.text));busy(false);
  }
  function message(role,text){const p=document.createElement('p');p.className='partner-message '+role;p.textContent=(role==='user'?t('partner.you'):t('partner.title'))+': '+text;p.dir='auto';dialog.querySelector('.partner-messages').append(p);p.scrollIntoView?.({block:'nearest'});}
  function busy(on){dialog.querySelector('[type=submit]').disabled=on;dialog.querySelectorAll('[data-question]').forEach(b=>b.disabled=on);dialog.querySelector('[data-cancel]').disabled=!on;dialog.querySelector('[data-speak]').disabled=!lastAnswer;dialog.querySelector('.partner-messages').setAttribute('aria-busy',String(on));}
  async function ask(question){
    question=question.trim();if(!question||request)return;
    const error=dialog.querySelector('.partner-error');error.textContent='';
    const snapshot=context();
    if(!navigator.onLine){
      message('user',question);
      dialog.querySelector('textarea').value='';
      const offlineReply=answerOffline({question,module,snapshot,level:getPartnerPrefs().level});
      lastAnswer=offlineReply;history.push({role:'user',text:question},{role:'model',text:offlineReply});history=history.slice(-8);
      message('model',offlineReply);
      busy(false);
      return;
    }
    const controller=new AbortController();request=controller;busy(true);message('user',question);
    dialog.querySelector('textarea').value='';
    const timeout=setTimeout(()=>controller.abort(),35000);
    try {
      let finalAnswer = null;
      let usedDirectKey = false;
      try {
        const response=await fetch('/api/lab-partner',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({question,context:snapshot,level:getPartnerPrefs().level,history:history.slice(-8).map(m=>({...m,text:m.text.slice(0,1200)}))})});
        let data=null;
        try { data=await response.json(); } catch {}
        if(response.ok && typeof data?.answer==='string'){
          finalAnswer = data.answer;
        } else if(data && typeof data.error==='string'){
          throw new Error(data.error);
        } else {
          throw new Error('NO_SERVER');
        }
      } catch(fetchErr) {
        if(fetchErr.name==='AbortError') throw fetchErr;
        if(fetchErr.message!=='NO_SERVER') throw fetchErr;

        const clientKey = getGeminiApiKey();
        if(clientKey) {
          usedDirectKey = true;
          finalAnswer = await callGeminiDirect({
            question,
            context: snapshot,
            level: getPartnerPrefs().level,
            history,
            signal: controller.signal,
            apiKey: clientKey
          });
        } else {
          promptKeyOrOffline(question, snapshot);
          return;
        }
      }

      if(!alive||request!==controller)return;
      lastAnswer=finalAnswer;history.push({role:'user',text:question},{role:'model',text:finalAnswer});history=history.slice(-8);
      message('model',finalAnswer);
      const note=document.createElement('small');note.textContent=usedDirectKey ? '⚡ Answered by Gemini AI' : t('partner.snapshotNote');dialog.querySelector('.partner-messages').append(note);
    } catch(e){
      if(alive&&request===controller)error.textContent=e.name==='AbortError'?t('partner.cancelled'):e.message;
    }
    finally {clearTimeout(timeout);if(request===controller){request=null;if(alive)busy(false);}}
  }

  function promptKeyOrOffline(q, snap) {
    const error=dialog.querySelector('.partner-error');
    error.innerHTML=`<div class="partner-key-box" style="border:1px solid currentColor;border-radius:10px;padding:0.75rem;margin-block:0.5rem;background:rgba(15,118,110,0.06);font-size:0.9rem;">
      <p style="font-weight:600;margin-bottom:0.3rem;">🔑 Live AI API Key Needed for GitHub Pages</p>
      <p style="margin-bottom:0.5rem;opacity:0.9;">GitHub Pages does not run a backend server. Enter your free Gemini API key to enable live AI, or use the built-in Smart Offline Tutor.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.5rem;">
        <input type="password" id="p-key-input" placeholder="Paste Gemini API Key (AIzaSy...)" style="flex:1 1 180px;padding:6px;border:1px solid currentColor;border-radius:6px;background:inherit;color:inherit;font-family:monospace;font-size:13px;">
        <button class="btn primary" type="button" id="p-save-key" style="min-height:32px;padding:4px 12px;font-size:13px;">Save & Ask</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <button class="btn" type="button" id="p-use-offline" style="min-height:32px;padding:4px 10px;font-size:13px;">⚡ Answer with Smart Offline Tutor</button>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="font-size:12px;text-decoration:underline;">Get Free API Key</a>
      </div>
    </div>`;
    error.querySelector('#p-save-key').onclick=()=>{
      const k=error.querySelector('#p-key-input').value.trim();
      if(k){
        setGeminiApiKey(k);
        error.innerHTML='';
        ask(q);
      }
    };
    error.querySelector('#p-use-offline').onclick=()=>{
      error.innerHTML='';
      const offlineReply=answerOffline({question:q,module,snapshot:snap,level:getPartnerPrefs().level});
      lastAnswer=offlineReply;history.push({role:'user',text:q},{role:'model',text:offlineReply});history=history.slice(-8);
      message('model',offlineReply);
      const note=document.createElement('small');
      note.textContent='⚡ Answered by Built-in Lab Tutor (add Gemini key in Settings for Live AI)';
      dialog.querySelector('.partner-messages').append(note);
      busy(false);
    };
    busy(false);
  }
  function open(){if(!dialog.open)dialog.showModal();dialog.querySelector('textarea').focus();}
  floating.onclick=open;
  dialog.addEventListener('close',()=>floating.focus());
  const language=()=>{if(lastLanguage===getLanguage())return;lastLanguage=getLanguage();request?.abort();request=null;history=[];lastAnswer='';floating.textContent=t('partner.title');drawTools();drawChat();};
  document.addEventListener('spark-language',language);
  const timer=setInterval(refresh,500);
  drawTools();drawChat();
  return ()=>{alive=false;request?.abort();clearInterval(timer);voice?.dispose();document.removeEventListener('spark-language',language);dialog.remove();floating.remove();block.remove();};
}
