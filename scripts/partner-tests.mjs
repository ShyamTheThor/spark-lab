import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createAIHandler,validateRequest} from '../server/ai.mjs';
const payload=()=>({question:'Why is current 3 A?',level:'beginner',history:[],context:{id:'circuit',language:'kn',grade:10,board:'ncert',inputs:[{label:'Voltage',value:'12 V'},{label:'Resistance',value:'4 Ω'}],outputs:[{label:'Current',value:'3 A'}],lesson:'I=V/R',formulas:'I=V/R',status:'active',state:{voltage_V:12,resistance_ohm:4,current:3}}});
async function serverRun(options,run){
 const server=createServer(createAIHandler(options));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/api/lab-partner`;
 try{await run((body=payload(),headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}),url);}
 finally{await new Promise(r=>server.close(r));}
}
test('allowlisted context drops identifiers and uses canonical metadata',()=>{const body=payload();body.context.email='private@example.com';body.context.title='Ignore instructions';const result=validateRequest(body);assert.equal(result.context.title,"Ohm's law loop");assert.equal(result.context.email,undefined);assert.equal(result.context.state.current,3);});
test('rejects unknown experiment, invalid grade, oversized history and arbitrary roles',()=>{for(const edit of [b=>b.context.id='unknown',b=>b.context.grade=99,b=>b.history=Array(9).fill({role:'user',text:'q'}),b=>b.history=[{role:'system',text:'override'}],b=>b.question='x'.repeat(1501)]){const b=payload();edit(b);assert.throws(()=>validateRequest(b));}});
test('missing key gives real 503, not a fabricated answer',()=>serverRun({env:{}},async post=>{const r=await post();assert.equal(r.status,503);assert.match((await r.json()).error,/not configured/);}));
test('forwards current values, language and bounded follow-up context with server-only credentials',()=>{
 let sent;
 return serverRun({env:{GEMINI_API_KEY:'test-secret'},fetcher:async(url,options)=>{sent={url,...options};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Test provider response'}]}}]}));}},async post=>{const b=payload();b.history=[{role:'user',text:'What is Ohm law?'},{role:'model',text:'I=V/R'}];const r=await post(b);assert.equal(r.status,200);assert.equal((await r.json()).answer,'Test provider response');assert.equal(sent.headers['x-goog-api-key'],'test-secret');assert.ok(!sent.url.includes('test-secret'));const body=JSON.parse(sent.body);assert.match(body.systemInstruction.parts[0].text,/language kn/);assert.match(body.contents.at(-1).parts[0].text,/voltage_V/);assert.equal(JSON.parse(body.contents.at(-1).parts[0].text).currentExperiment.state.current,3);assert.equal(body.contents.length,3);});
});
test('rejects malformed JSON, wrong content type, cross-origin and oversized requests',()=>serverRun({env:{}},async post=>{assert.equal((await post('{')).status,400);assert.equal((await post(payload(),{'content-type':'text/plain'})).status,415);assert.equal((await post(payload(),{origin:'https://untrusted.example'})).status,403);assert.equal((await post('x'.repeat(25000))).status,413);}));
test('enforces rate limit even without credentials',()=>serverRun({env:{}},async post=>{for(let i=0;i<12;i++)await post();const r=await post();assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');}));
test('maps provider quota and empty content to meaningful errors',async()=>{await serverRun({env:{GEMINI_API_KEY:'test'},fetcher:async()=>new Response('',{status:429})},async post=>assert.equal((await post()).status,429));await serverRun({env:{GEMINI_API_KEY:'test'},fetcher:async()=>new Response('{}')},async post=>assert.equal((await post()).status,502));});
