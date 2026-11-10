import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeoService,insideBrazil,UFS} from '../src/geo.js';
test('geometria rejeita ponto fora do Brasil mesmo dentro da caixa aproximada',()=>{
  assert.equal(UFS.length,27);assert.equal(insideBrazil(-23.55,-46.63),true);assert.equal(insideBrazil(-17,-63),false);assert.equal(insideBrazil(NaN,0),false);
});
test('geocodificação estruturada não envia número, usa fallback cidade e espaça as chamadas',async()=>{
  const calls=[];
  const geo=createGeoService({userAgent:'CoNexo teste (teste@example.org)',intervalMs:20,request:async url=>{
    calls.push({at:Date.now(),url});return {ok:true,json:async()=>url.searchParams.has('street')?[]:[{lat:'-23.55',lon:'-46.63'}]};
  }});
  const point=await geo.geocode({street:'Avenida Paulista',number:'123',city:'São Paulo',state:'SP'});
  assert.equal(point.nivel,'cidade');assert.equal(calls.length,2);assert.ok(calls[1].at-calls[0].at>=18);
  assert.equal(calls[0].url.searchParams.get('street'),'Avenida Paulista');assert.equal(calls[0].url.searchParams.has('number'),false);
  assert.equal(calls[0].url.searchParams.get('country'),'Brasil');
  await geo.geocode({street:'Avenida Paulista',city:'São Paulo',state:'SP'});assert.equal(calls.length,2);
});
test('falha do provedor usa o estado sem confirmar automaticamente',async()=>{
  const geo=createGeoService({userAgent:'Teste',intervalMs:0,request:async()=>{throw new Error('indisponível');}});
  const point=await geo.geocode({street:'Rua',city:'Cidade',state:'SP'});assert.equal(point.nivel,'uf');assert.equal(insideBrazil(point.latitude,point.longitude),true);
  assert.throws(()=>geo.validateConfirmed({...point,state:'SP',locationConfirmed:false}),/Confirme/);
});
