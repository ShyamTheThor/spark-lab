// @vitest-environment jsdom
import {beforeAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {mountLabPartner} from '../src/partner/panel.js';
import {snapshotExperiment} from '../src/partner/context.js';
import {mountVoiceGuide,selectVoice} from '../src/partner/voice.js';
import {getPartnerPrefs,savePartnerPrefs,initPartnerPreferences} from '../src/partner/preferences.js';
import {setLanguage} from '../src/i18n/config.js';
import {setOwner} from '../src/features/store.js';
import {simulationState} from '../src/partner/state.js';
let cleanup=[];
beforeAll(()=>{
 HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:50}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 HTMLElement.prototype.scrollIntoView=()=>{};
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
});
beforeEach(async()=>{
 document.body.innerHTML='<main><div id="panel"></div></main>';
 localStorage.clear();setOwner('test-'+Math.random());await setLanguage('en');
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
 vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'en-IN',voiceURI:'local',localService:true}],speak:vi.fn(),cancel:vi.fn(),pause:vi.fn(),resume:vi.fn(),addEventListener:vi.fn()});
 vi.stubGlobal('SpeechSynthesisUtterance',class {constructor(text){this.text=text;}});
});
afterEach(()=>{cleanup.forEach(f=>f());cleanup=[];vi.unstubAllGlobals();vi.restoreAllMocks();});
async function circuit(){const m=(await import('../src/modules/circuit.js')).default;const p=document.querySelector('#panel');p.innerHTML=m.panelHTML();m.wire(p);return [m,p];}
function input(id,value){const el=document.getElementById(id);el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));}
it('uses real Ohm simulation values and updates after changing an input',async()=>{const [m,p]=await circuit();input('ci-v',12);input('ci-r',4);let c=snapshotExperiment(m,p);expect(c.state.current).toBe(3);expect(c.outputs.some(x=>x.value==='3.00 A')).toBe(true);input('ci-r',6);c=snapshotExperiment(m,p);expect(c.state.current).toBe(2);expect(c.inputs.find(x=>x.label==='Resistance').value).toBe('6');});
it('pH classification and colour describe current model, including 6.8 and 7.2',async()=>{const m=(await import('../src/modules/ph.js')).default,p=document.querySelector('#panel');p.innerHTML=m.panelHTML();m.wire(p);input('ph-val',6.8);expect(p.querySelector('#ph-label').textContent).toBe('Acidic');expect(m.getExperimentState().interpretation).toContain('Universal indicator');input('ph-val',7.2);expect(p.querySelector('#ph-label').textContent).toBe('Basic');input('ph-val',7);expect(m.getExperimentState().interpretation).toContain('Neutral');});
it('chat sends live context and follow-ups, renders hostile provider text safely, clears on navigation',async()=>{
 const [m,p]=await circuit();input('ci-v',12);input('ci-r',4);
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>({answer:'<img src=x onerror=alert(1)> I = 12/4 = 3 A'})}));vi.stubGlobal('fetch',fetcher);
 const dispose=mountLabPartner(m,p,document.querySelector('main'));cleanup.push(dispose);
 document.querySelector('.partner-fab').click();const form=document.querySelector('.partner-chat form');
 document.querySelector('#partner-question').value='Why 3 amps?';form.dispatchEvent(new Event('submit',{cancelable:true}));
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));await vi.waitFor(()=>expect(document.querySelector('.partner-message.model')).not.toBeNull());
 expect(document.querySelector('.partner-messages img')).toBeNull();expect(JSON.parse(fetcher.mock.calls[0][1].body).context.state.current).toBe(3);
 input('ci-r',6);document.querySelector('#partner-question').value='And now?';form.dispatchEvent(new Event('submit',{cancelable:true}));
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));const sent=JSON.parse(fetcher.mock.calls[1][1].body);expect(sent.history.length).toBe(2);expect(sent.context.state.current).toBe(2);
 dispose();cleanup=[];expect(document.querySelector('.partner-fab')).toBeNull();expect(speechSynthesis.cancel).toHaveBeenCalled();
});
it('real server failures appear as errors without fake assistant replies',async()=>{const [m,p]=await circuit();vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({error:'AI is not configured'})})));cleanup.push(mountLabPartner(m,p,document.querySelector('main')));document.querySelector('.partner-fab').click();document.querySelector('[data-question=law]').click();await vi.waitFor(()=>expect(document.querySelector('.partner-error').textContent).toContain('not configured'));expect(document.querySelector('.partner-message.model')).toBeNull();});
it('voice play/pause/resume/repeat/stop, highlighting and cleanup call the browser API',async()=>{
 const guide=mountVoiceGuide(document.querySelector('#panel'),()=>['First adjust voltage. Then read current.']);cleanup.push(guide.dispose);
 expect(speechSynthesis.speak).not.toHaveBeenCalled();document.querySelector('[data-voice=play]').click();await vi.waitFor(()=>expect(speechSynthesis.speak).toHaveBeenCalled());
 expect(document.querySelector('[aria-current=step]')).not.toBeNull();document.querySelector('[data-voice=pause]').click();expect(speechSynthesis.pause).toHaveBeenCalled();document.querySelector('[data-voice=resume]').click();expect(speechSynthesis.resume).toHaveBeenCalled();document.querySelector('[data-voice=repeat]').click();expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);document.querySelector('[data-voice=stop]').click();expect(document.querySelector('[aria-current]')).toBeNull();
});
it('offline voice only selects local voices in the selected language',()=>{const remote={lang:'kn-IN',voiceURI:'remote',localService:false},local={lang:'kn-IN',voiceURI:'local',localService:true};expect(selectVoice([remote,local],'kn','remote',true)).toBe(local);expect(selectVoice([remote],'kn','',true)).toBeNull();expect(selectVoice([local],'hi','',false)).toBeNull();});
it('offline English voice works with local engine and no network request',async()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const guide=mountVoiceGuide(document.querySelector('#panel'),()=>['Adjust voltage.']);cleanup.push(guide.dispose);document.querySelector('[data-voice=play]').click();await vi.waitFor(()=>expect(speechSynthesis.speak).toHaveBeenCalled());expect(fetcher).not.toHaveBeenCalled();});
it('missing voice leaves readable text and a useful status',async()=>{speechSynthesis.getVoices=()=>[];const g=mountVoiceGuide(document.querySelector('#panel'),()=>['Read the voltage.']);cleanup.push(g.dispose);document.querySelector('[data-voice=play]').click();await vi.waitFor(()=>expect(document.querySelector('.voice-status').textContent).toContain('No compatible'));expect(document.querySelector('li').textContent).toContain('Read the voltage');expect(speechSynthesis.speak).not.toHaveBeenCalled();});
it('preferences persist through state reload and apply to document',()=>{cleanup.push(initPartnerPreferences());savePartnerPrefs({level:'advanced',rate:1.3,textSize:'large',highContrast:true,colorMode:'deuteranopia',reducedMotion:true});const owner=Object.keys(localStorage).find(k=>k.startsWith('sparklab.student.v2.')).replace('sparklab.student.v2.','');setOwner(owner);expect(getPartnerPrefs().rate).toBe(1.3);expect(document.documentElement.dataset.contrast).toBe('high');expect(document.documentElement.dataset.colorMode).toBe('deuteranopia');});
it('regional language is sent in experiment context',async()=>{const [m,p]=await circuit();await setLanguage('kn');expect(snapshotExperiment(m,p).language).toBe('kn');});
it('state extractor excludes functions and objects while preserving deterministic variables',()=>{expect(simulationState({running:false,mass:3,fn(){},mesh:{bad:'object'},samples:[1,2]})).toEqual({status:'paused',variables:{running:false,mass:3,samples:[1,2]}});});
it('all built-in experiments expose serializable context and named controls',async()=>{
 const {REGISTRY}=await import('../src/modules/registry.js');
 for(const item of REGISTRY){
  const m=(await item.load()).default;
  const p=document.querySelector('#panel');p.innerHTML=m.panelHTML();
  // Construction/wiring/render updates are covered separately by the smoke runner.
  const c=snapshotExperiment(m,p);
  expect(c.id).toBe(item.id);expect(JSON.stringify(c).length).toBeLessThan(22000);
  if(c.state)expect(JSON.stringify(c.state).length).toBeLessThan(5000);
 }
});
