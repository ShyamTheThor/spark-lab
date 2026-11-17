import * as THREE from 'three';
import {getPartnerPrefs} from './preferences.js';
// Apply optional line patterns without recolouring scientific colour phenomena.
// Mesh wireframes provide geometry cues; original materials are restored on exit.
export function mountAccessibleScene(scene,host) {
  const originals=new Map(),edges=[];
  const note=document.createElement('p');note.className='fact scene-access-note';host.append(note);
  function restore(){for(const edge of edges){edge.removeFromParent();edge.geometry.dispose();edge.material.dispose();}edges.length=0;for(const [object,original] of originals){object.material.dispose();object.material=original;}originals.clear();}
  function apply(){
    restore();const mode=getPartnerPrefs().colorMode;
    note.hidden=mode==='none';
    note.textContent='Accessible 3D view: geometry edges and patterned lines supplement colour. Scientific colours are preserved; read the current simulation data for quantities and meanings.';
    if(mode==='none')return;
    let index=0;
    const palette=mode==='tritanopia'?[0x0072b2,0xcc3311,0x222222]:[0x0072b2,0xa64b00,0x222222];
    scene.traverse(object=>{
      if(object.isLine && !Array.isArray(object.material)&&!object.isLineSegments){
        const old=object.material;
        object.material=new THREE.LineDashedMaterial({color:palette[index%3],dashSize:.12+(index%3)*.1,gapSize:.08,transparent:old.transparent,opacity:old.opacity});
        originals.set(object,old);object.computeLineDistances();index++;
      }
      // Do not turn labels/sprites or physical liquid/glass into a wireframe.
      if(object.isMesh && !Array.isArray(object.material) && !object.material.transparent && !object.material.map && object.geometry?.attributes.position?.count<10000){
        const edge=new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry,25),new THREE.LineBasicMaterial({color:0x202020}));
        edge.userData.accessibleEdge=true;object.add(edge);edges.push(edge);
      }
    });
  }
  apply();document.addEventListener('spark-accessibility',apply);
  return ()=>{restore();note.remove();document.removeEventListener('spark-accessibility',apply);};
}
