import { api, backendEnabled } from './auth-client.js';
const maps = new Map();
export function mountLocation(id, fields, initial) {
  if(!backendEnabled)return;
  const container=document.getElementById(id);container.hidden=false;
  const canvas=container.querySelector('[data-map]'),confirmation=container.querySelector('[data-confirm-location]'),feedback=container.querySelector('[data-location-feedback]');
  let point=initial?{latitude:initial.latitude,longitude:initial.longitude}:null;
  let ready=Boolean(initial),confirmed=Boolean(initial),revision=0;
  const map=L.map(canvas).setView(initial?[point.latitude,point.longitude]:[-14.2,-51.9],initial?15:4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  const marker=L.marker(initial?[point.latitude,point.longitude]:[-14.2,-51.9],{draggable:true,keyboard:true,title:'Local da instituição; arraste ou use as setas para ajustar'}).addTo(map);
  const status=()=>{const p=marker.getLatLng();point={latitude:p.lat,longitude:p.lng};feedback.textContent=`Pino: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}. Confirme se corresponde à instituição.`;};
  const moved=()=>{revision++;ready=true;confirmed=false;confirmation.checked=false;status();};
  marker.on('dragend',moved);
  marker.getElement().addEventListener('keydown',event=>{
    const changes={ArrowUp:[0.0001,0],ArrowDown:[-0.0001,0],ArrowLeft:[0,-0.0001],ArrowRight:[0,0.0001]};
    if(!changes[event.key])return;event.preventDefault();event.stopPropagation();const p=marker.getLatLng(),[lat,lon]=changes[event.key];marker.setLatLng([p.lat+lat,p.lng+lon]);moved();
  });
  map.on('click',event=>{marker.setLatLng(event.latlng);moved();});
  confirmation.checked=confirmed;
  confirmation.addEventListener('change',()=>{confirmed=ready&&confirmation.checked;if(!ready){confirmation.checked=false;feedback.textContent='Localize o endereço ou mova o pino antes de confirmar.';}});
  for(const selector of [fields.street,fields.city,fields.state,fields.number].filter(Boolean))document.querySelector(selector).addEventListener('input',()=>{revision++;confirmed=false;ready=false;confirmation.checked=false;});
  container.querySelector('[data-geocode]').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;const requestRevision=++revision;confirmed=false;ready=false;confirmation.checked=false;feedback.textContent='Localizando endereço…';
    try {
      const result=await api('/localizacoes/geocodificar',{method:'POST',body:{street:document.querySelector(fields.street).value,city:document.querySelector(fields.city).value,state:document.querySelector(fields.state).value}});
      if(requestRevision!==revision)return;
      marker.setLatLng([result.latitude,result.longitude]);map.setView(marker.getLatLng(),result.nivel==='rua'?16:result.nivel==='cidade'?12:6);ready=true;confirmed=false;confirmation.checked=false;status();
      if(result.nivel!=='rua')feedback.textContent='Não foi possível localizar a rua. O pino é aproximado: ajuste para o local da instituição e confirme.';
    }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
  });
  maps.set(id,{get:()=>({latitude:point?.latitude,longitude:point?.longitude,locationConfirmed:confirmed}),resize:()=>map.invalidateSize(),reset:value=>{revision++;point=value?{latitude:value.latitude,longitude:value.longitude}:null;ready=confirmed=Boolean(value);confirmation.checked=confirmed;marker.setLatLng(value?[point.latitude,point.longitude]:[-14.2,-51.9]);map.setView(marker.getLatLng(),value?15:4);feedback.textContent='';}});
  document.addEventListener('conexo:navigate',()=>{if(!container.closest('[data-page]').hidden)setTimeout(()=>map.invalidateSize(),0);});
}
export function locationValue(id) {return maps.get(id)?.get()||{};}

export function resetLocation(id,initial){maps.get(id)?.reset(initial);}
