// Snapshot primitive simulation variables without serializing Three.js objects,
// executable functions, DOM nodes or arbitrary object graphs.
export function simulationState(state) {
  const values={};
  for(const [key,value] of Object.entries(state||{})) {
    if(typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean') values[key]=value;
    else if(typeof value==='string') values[key]=value.slice(0,300);
    else if(Array.isArray(value)&&value.length<=100&&value.every(x=>typeof x==='number'&&Number.isFinite(x))) values[key]=[...value];
  }
  return {status:typeof state?.running==='boolean'?(state.running?'running':'paused'):'Live simulation state; no explicit running flag',variables:values};
}
