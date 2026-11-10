import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {MongoClient} from 'mongodb';
import {loadConfig} from '../src/config.js';
import {createPool} from '../src/db.js';
import {createRepository} from '../src/repository.js';
import {createAuthService} from '../src/auth-service.js';
import {createGeoService,insideBrazil} from '../src/geo.js';
import {createPrinterService} from '../src/printers.js';
import {createApp} from '../src/app.js';
const config=loadConfig();
assert.equal(process.env.NODE_ENV,'test','Use NODE_ENV=test para a suíte com bancos descartáveis.');
assert.ok(config.mysql.database.endsWith('_test')&&config.mongoDatabase.endsWith('_test'),'A suíte só aceita bancos terminados em _test.');
config.bcryptCost=4; // Somente fixture de teste; a configuração de execução permanece custo 12.
const pool=createPool(config.mysql),mongo=new MongoClient(config.mongoUri),suffix=randomUUID().slice(0,8);
let app,server,base,collection,root,pending,partner;
const credentials={password:'Teste-1234!'};
class Client {
  cookie='';csrf='';
  async request(method,path,body,{csrf=true,header}={}) {
    if(csrf&&!['GET','HEAD'].includes(method)&&!this.csrf)await this.request('GET','/api/auth/csrf');
    const headers={cookie:this.cookie};if(body!==undefined)headers['content-type']='application/json';
    if(csrf&&this.csrf)headers['x-csrf-token']=this.csrf;if(header)headers['x-csrf-token']=header;
    const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    for(const cookie of response.headers.getSetCookie())if(cookie.startsWith('conexo.sid='))this.cookie=cookie.split(';')[0];
    const contentType=response.headers.get('content-type')||'';
    const value=response.status===204?null:contentType.includes('application/json')?await response.json():await response.text();
    if(value?.csrfToken)this.csrf=value.csrfToken;
    return {status:response.status,value,headers:response.headers};
  }
  async login(email){const r=await this.request('POST','/api/auth/login',{email,...credentials,perfil:'parceiro'});assert.equal(r.status,200);return r.value.user;}
}
const aacdBody=email=>({email,...credentials,phone:'11988887777',unit:'Mooca',holder:'Conta teste'});
const partnerBody=email=>({email,...credentials,phone:'11977776666',institution:'Lab de teste',responsible:'Responsável teste',street:'Avenida Paulista',number:'',city:'São Paulo',state:'SP',latitude:-23.55,longitude:-46.63,locationConfirmed:true,termsAccepted:true});
const printerBody={modelo:'FDM de teste',capacidade:{x:200,y:200,z:200},bicos:[0.4],materiais_compativeis:['PLA','PETG'],materiais_disponiveis:['PLA']};
before(async()=>{
  await mongo.connect();collection=mongo.db(config.mongoDatabase).collection('impressoras');
  const auth=createAuthService(createRepository(pool),config,createGeoService());
  root=await auth.register('aacd',aacdBody('root-'+suffix+'@example.org'),{seed:true});
  app=createApp({pool,config,geo:createGeoService(),printers:createPrinterService(collection)});
  await app.locals.sessionStore.onReady();
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(app)await app.locals.sessionStore.close();await mongo.close();await pool.end();});
test('cadastro AACD grava bcrypt e ignora aprovação do cliente',async()=>{
  const client=new Client();const forged=await client.request('POST','/api/auth/cadastros/aacd',{...aacdBody('forged-'+suffix+'@example.org'),homologado:true});assert.equal(forged.status,422);
  const response=await client.request('POST','/api/auth/cadastros/aacd',aacdBody('pending-'+suffix+'@example.org'));
  assert.equal(response.status,201);pending=response.value.user;assert.equal(pending.homologado,false);assert.ok(!('senha_hash' in pending));
  const [[row]]=await pool.execute('SELECT senha_hash FROM aacd WHERE id=?',[pending.id]);assert.match(row.senha_hash,/^\$2[aby]\$/);assert.notEqual(row.senha_hash,credentials.password);assert.ok(await bcrypt.compare(credentials.password,row.senha_hash));
});
test('perfil vem do banco; senha incorreta e CSRF inválido são rejeitados',async()=>{
  const client=new Client();assert.equal((await client.request('POST','/api/auth/login',{email:root.email,password:'errada'})).status,401);
  assert.equal((await client.request('POST','/api/auth/login',{email:root.email,...credentials},{csrf:false})).status,403);
  await client.request('GET','/api/auth/csrf');assert.equal((await client.request('POST','/api/auth/login',{email:root.email,...credentials},{header:'é'.repeat(64)})).status,403);
  const user=await client.login(root.email);assert.equal(user.perfil,'aacd');assert.equal(user.homologado,true);
  const response=await client.request('GET','/api/auth/csrf');assert.ok(client.cookie.includes('conexo.sid='));
  const loginClient=new Client();const logged=await loginClient.request('POST','/api/auth/login',{email:root.email,...credentials});assert.match(logged.headers.get('set-cookie'),/HttpOnly/i);assert.match(logged.headers.get('set-cookie'),/SameSite=Lax/i);
});
test('homologação AACD exige conta já homologada e passa a valer na sessão existente',async()=>{
  const waiting=new Client();await waiting.login(pending.email);
  assert.equal((await waiting.request('GET','/api/aacd/pendentes')).status,403);
  assert.equal((await waiting.request('PATCH','/api/me',{email:pending.email,phone:pending.telefone,holder:pending.nome,unit:pending.unidade})).status,403);
  assert.equal((await waiting.request('POST','/api/solicitacoes/codigos',{material:'PLA'})).status,403);
  const approved=new Client();await approved.login(root.email);
  assert.ok((await approved.request('GET','/api/aacd/pendentes')).value.items.some(user=>user.id===pending.id));
  assert.equal((await approved.request('POST','/api/aacd/'+pending.id+'/homologacao')).status,200);
  assert.equal((await waiting.request('GET','/api/auth/me')).value.user.homologado,true);
  assert.equal((await waiting.request('POST','/api/solicitacoes/codigos',{material:'PLA'})).status,201);
});
test('parceiro confirma coordenada no Brasil, número opcional e fica não homologado',async()=>{
  const client=new Client();const invalid={...partnerBody('invalid-'+suffix+'@example.org'),latitude:-17,longitude:-63};
  assert.equal(insideBrazil(-17,-63),false);assert.equal((await client.request('POST','/api/auth/cadastros/parceiros',invalid)).status,422);
  assert.equal((await client.request('POST','/api/auth/cadastros/parceiros',{...partnerBody('unconfirmed-'+suffix+'@example.org'),locationConfirmed:false})).status,422);
  const result=await client.request('POST','/api/auth/cadastros/parceiros',partnerBody('partner-'+suffix+'@example.org'));assert.equal(result.status,201);partner=result.value.user;assert.equal(partner.homologado,false);assert.equal(partner.numero,'');
  await client.login(partner.email);assert.equal((await client.request('POST','/api/aacd/'+root.id+'/homologacao')).status,403);
});
test('um email não pode ser cadastrado simultaneamente nas duas tabelas',async()=>{
  const email='race-'+suffix+'@example.org';const a=new Client(),b=new Client();
  const responses=await Promise.all([a.request('POST','/api/auth/cadastros/aacd',aacdBody(email)),b.request('POST','/api/auth/cadastros/parceiros',partnerBody(email))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  assert.equal((await createRepository(pool).byEmail(email)).length,1);
});
test('impressoras persistem no Mongo, respeitam proprietário e soft delete',async()=>{
  const client=new Client();await client.login(partner.email);
  const created=await client.request('POST','/api/impressoras',printerBody);assert.equal(created.status,201);const id=created.value._id;assert.deepEqual(created.value.necessidade_por_material,{PLA:false,PETG:true});
  const second=new Client();const other=await second.request('POST','/api/auth/cadastros/parceiros',partnerBody('other-'+suffix+'@example.org'));assert.equal(other.status,201);await second.login(other.value.user.email);
  assert.equal((await second.request('GET','/api/impressoras/'+id)).status,404);assert.equal((await second.request('DELETE','/api/impressoras/'+id)).status,404);
  assert.equal((await client.request('PATCH','/api/impressoras/'+id,{...printerBody,materiais_disponiveis:['ABS']})).status,422);
  assert.equal((await client.request('PATCH','/api/impressoras/'+id,printerBody)).status,200);
  assert.equal((await client.request('DELETE','/api/impressoras/'+id)).status,200);
  const raw=await collection.findOne({modelo:printerBody.modelo,id_parceiro:Number(partner.id)});assert.ok(raw);assert.equal(raw.ativa,false);
  assert.equal((await client.request('GET','/api/impressoras/'+id)).status,404);
});
test('código possui material e ID numérico persistente; cliente não escolhe o ID',async()=>{
  const client=new Client();await client.login(root.email);
  const a=await client.request('POST','/api/solicitacoes/codigos',{material:'PETG',id:0});const b=await client.request('POST','/api/solicitacoes/codigos',{material:'PETG'});
  assert.equal(a.status,201);assert.match(a.value.code,/^PETG-[0-9]+$/);assert.ok(BigInt(b.value.id)>BigInt(a.value.id));
  const [[row]]=await pool.execute('SELECT material,id_aacd FROM codigo_solicitacao WHERE id=?',[a.value.id]);assert.equal(row.material,'PETG');assert.equal(String(row.id_aacd),root.id);
  assert.equal((await client.request('POST','/api/solicitacoes/codigos',{material:'Resina'})).status,422);
});
test('edição própria não promove perfil, não troca unidade e logout invalida acesso',async()=>{
  const client=new Client();await client.login(root.email);
  assert.equal((await client.request('PATCH','/api/me',{email:root.email,phone:root.telefone,holder:root.nome,unit:'Ibirapuera'})).status,409);
  assert.equal((await client.request('PATCH','/api/me',{email:root.email,phone:root.telefone,holder:root.nome,unit:root.unidade,homologado:true})).status,422);
  assert.equal((await client.request('PATCH','/api/me',{email:root.email,phone:root.telefone,holder:'Nome atualizado',unit:root.unidade})).status,200);
  assert.equal((await client.request('POST','/api/auth/logout')).status,204);assert.equal((await client.request('GET','/api/auth/me')).status,401);
});
test('segredos e arquivos do backend não são publicados como estáticos',async()=>{
  const client=new Client();for(const path of ['/backend/.env','/.env','/backend/package.json','/docs/backend/mysql-proposta.sql'])assert.equal((await client.request('GET',path)).status,404);
  const runtime=await client.request('GET','/runtime-config.js');assert.equal(runtime.status,200);assert.match(runtime.value,/backend:true/);assert.ok(!runtime.value.includes(config.secret));
});
test('sessão persiste no MySQL após reconstruir a aplicação',async()=>{
  const client=new Client();await client.login(root.email);
  await new Promise(resolve=>server.close(resolve));await app.locals.sessionStore.close();
  app=createApp({pool,config,geo:createGeoService(),printers:createPrinterService(collection)});await app.locals.sessionStore.onReady();
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
  assert.equal((await client.request('GET','/api/auth/me')).status,200);
});

test('unicidade entre tabelas respeita também a equivalência de acentos do MySQL',async()=>{
  const a=new Client(),b=new Client();
  const responses=await Promise.all([a.request('POST','/api/auth/cadastros/aacd',aacdBody('accent-e-'+suffix+'@example.org')),b.request('POST','/api/auth/cadastros/parceiros',partnerBody('accent-é-'+suffix+'@example.org'))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
});
