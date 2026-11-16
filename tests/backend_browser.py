"""Teste da fatia conectada; exige backend de teste e seed configurados em ambiente.
Ex.: CONEXO_BACKEND_URL=http://127.0.0.1:3001. Nunca usa credenciais reais.
"""
import os,re,uuid
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('CONEXO_BACKEND_URL','http://127.0.0.1:3001/')
ADMIN_EMAIL=os.environ['SEED_AACD_EMAIL']
ADMIN_PASSWORD=os.environ['SEED_AACD_PASSWORD']
if os.environ.get('NODE_ENV')!='test':raise SystemExit('Use NODE_ENV=test e somente bancos descartáveis.')
suffix=uuid.uuid4().hex[:8]
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or '/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def context():
  ctx=browser.new_context(viewport={'width':1440,'height':1000})
  # Provedores externos não são validados nesta suíte: não contorna a política de rede.
  ctx.route('https://cdn.userway.org/**',lambda route:route.abort('blockedbyclient'))
  ctx.route('https://tile.openstreetmap.org/**',lambda route:route.abort('blockedbyclient'))
  ctx.route('**/api/localizacoes/geocodificar',lambda route:route.fulfill(json={'latitude':-23.55,'longitude':-46.63,'nivel':'cidade'}))
  ctx.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
  return ctx
 def login(page,email,password):
  page.goto(URL+'#login');expect(page.locator('#login')).to_be_visible()
  page.locator('#login [name=email]').fill(email);page.locator('#login [name=password]').fill(password)
  page.get_by_role('button',name='Entrar no Sistema',exact=True).click()
 admin_context=context();admin=admin_context.new_page()
 pending_reads=[]
 admin.on('request',lambda request:pending_reads.append(request.url) if request.method=='GET' and request.url.endswith('/api/parceiros?homologado=false') else None)
 admin.goto(URL+'#login');expect(admin.locator('#login')).to_be_visible()
 admin.get_by_role('button',name='Parceiro',exact=True).click()
 admin.locator('#login [name=email]').fill(ADMIN_EMAIL);admin.locator('#login [name=password]').fill(ADMIN_PASSWORD)
 admin.get_by_role('button',name='Entrar no Sistema',exact=True).click()
 expect(admin.locator('#aacd-inicio')).to_be_visible()
 assert admin.locator('#partner-header').is_hidden()
 admin.get_by_role('link',name='Iniciar Especificação Técnica',exact=True).click()
 admin.get_by_role('button',name='Gerar Código',exact=True).click()
 expect(admin.locator('#code-dialog')).to_be_visible()
 admin.locator('#code-material').select_option('PETG')
 admin.locator('#code-dialog').get_by_role('button',name='Gerar',exact=True).click()
 expect(admin.locator('#code-dialog')).to_be_hidden()
 expect(admin.locator('#aacd-order-code')).to_have_value(re.compile(r'^PETG-[0-9]+$'))
 first_code=admin.locator('#aacd-order-code').input_value()
 admin.locator('#aacd-order-code').fill('CODIGO-MANUAL')
 assert admin.locator('#aacd-order-code').input_value()=='CODIGO-MANUAL'
 admin.evaluate("location.hash='aacd-perfil'");expect(admin.locator('#aacd-perfil')).to_be_visible()
 expect(admin.locator('#aacd-profile-unit')).to_be_disabled()
 admin.locator('#aacd-profile-phone').fill('11966665555')
 admin.locator('#aacd-profile-form [type=submit]').click()
 expect(admin.locator('#aacd-profile-feedback')).to_contain_text('atualizado')
 pending_context=context();pending=pending_context.new_page();pending_email='browser-pending-'+suffix+'@example.org'
 pending.goto(URL+'#cadastro-aacd');expect(pending.locator('#cadastro-aacd')).to_be_visible()
 for name,value in {'holder':'Conta pendente '+suffix,'email':pending_email,'password':ADMIN_PASSWORD,'confirmation':ADMIN_PASSWORD,'phone':'11966665555'}.items():pending.locator(f'#cadastro-aacd [name="{name}"]').fill(value)
 pending.locator('#cadastro-aacd [name=unit]').select_option('Ibirapuera')
 pending.locator('#cadastro-aacd').get_by_role('button',name='Avançar',exact=True).click()
 expect(pending.locator('#evaluation-dialog')).to_be_visible()
 pending.locator('#evaluation-dialog [data-bs-dismiss=modal]').click()
 login(pending,pending_email,ADMIN_PASSWORD)
 expect(pending.locator('#login-feedback')).to_contain_text('aguarda homologação')
 pending.evaluate("location.hash='aacd-inicio'");expect(pending.locator('#login')).to_be_visible()
 admin.evaluate("location.hash='aacd-homologacao'")
 candidate=admin.locator('#aacd-users-list article').filter(has_text=pending_email)
 expect(candidate).to_be_visible();candidate.get_by_role('button',name='Homologar conta AACD',exact=True).click();expect(candidate).to_have_count(0)
 pending.reload();login(pending,pending_email,ADMIN_PASSWORD);expect(pending.locator('#aacd-inicio')).to_be_visible()
 partner_context=context();partner=partner_context.new_page();partner_email='browser-partner-'+suffix+'@example.org'
 partner.goto(URL+'#termos-uso');expect(partner.locator('#termos-uso')).to_be_visible()
 partner.locator('#termos-uso-terms-scroll').evaluate('(el)=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"))}')
 partner.locator('#termos-uso-confirm-terms').click();expect(partner.locator('#parceiro-dados')).to_be_visible()
 values={'institution':'Laboratório Browser '+suffix,'responsible':'Responsável Browser','email':partner_email,'phone':'11955554444','password':ADMIN_PASSWORD,'confirmation':ADMIN_PASSWORD,'street':'Avenida Paulista','city':'São Paulo'}
 for name,value in values.items():partner.locator(f'#parceiro-dados [name="{name}"]').fill(value)
 partner.locator('#parceiro-dados [name=state]').select_option('SP')
 partner.locator('#parceiro-dados').get_by_role('button',name='Avançar',exact=True).click();expect(partner.locator('#parceiro-equipamentos')).to_be_visible()
 partner.locator('#register-printer-name').fill('FDM Browser '+suffix)
 for axis in ['X','Y','Z']:partner.locator('#parceiro-equipamentos [name=volume'+axis+']').fill('200')
 for material in ['PLA','PETG']:partner.locator('#parceiro-equipamentos [name=materials][value='+material+']').check()
 partner.locator('#parceiro-equipamentos [name=materialsAvailable][value=PLA]').check()
 partner.locator('#parceiro-equipamentos [name=nozzles][value="0.4"]').check()
 partner.locator('#parceiro-equipamentos').get_by_role('button',name='Avançar',exact=True).click();expect(partner.locator('#parceiro-logistica')).to_be_visible()
 partner.locator('#parceiro-logistica').get_by_role('button',name='Avançar',exact=True).click()
 expect(partner.locator('#parceiro-logistica .form-error')).to_contain_text('confirme')
 partner.get_by_role('button',name='Localizar no mapa',exact=True).click()
 expect(partner.locator('#registration-location [data-location-feedback]')).to_contain_text('apenas a cidade')
 marker=partner.locator('#registration-location .leaflet-marker-icon');expect(marker).to_be_visible();assert marker.evaluate('(el)=>el.complete&&el.naturalWidth>0')
 partner.set_viewport_size({'width':390,'height':844});assert partner.evaluate('document.documentElement.scrollWidth<=innerWidth');partner.set_viewport_size({'width':1440,'height':1000})
 marker.focus();marker.press('ArrowRight')
 partner.locator('#registration-location [data-confirm-location]').check()
 failures={'count':0}
 def fail_first_printer(route):
  if route.request.method=='POST' and failures['count']==0:
   failures['count']+=1;route.fulfill(status=503,content_type='application/json',body='{"error":{"message":"Falha temporária de teste"}}')
  else:route.continue_()
 partner_context.route('**/api/impressoras',fail_first_printer)
 partner.locator('#parceiro-logistica').get_by_role('button',name='Avançar',exact=True).click()
 expect(partner.locator('#parceiro-logistica .form-error')).to_contain_text('A conta foi criada.',timeout=15000)
 partner.locator('#parceiro-logistica').get_by_role('button',name='Avançar',exact=True).click()
 expect(partner.locator('#evaluation-dialog')).to_be_visible(timeout=15000)
 partner.locator('#evaluation-dialog [data-bs-dismiss=modal]').click();expect(partner.locator('#sobre-nos')).to_be_visible()
 admin.reload();expect(admin.locator('#aacd-homologacao')).to_be_visible()
 review=admin.locator('.aacd-review').filter(has_text='Laboratório Browser '+suffix)
 expect(admin.locator('[data-home-partners] .home-partner-line').filter(has_text='Laboratório Browser '+suffix)).to_have_count(1)
 review.locator('summary').click()
 reads_before=len(pending_reads)
 review.locator('[data-review-action=approve]').click();expect(review).to_have_count(0)
 expect(admin.locator('#aacd-review-feedback')).to_contain_text('homologado')
 expect(admin.locator('[data-home-partners] .home-partner-line').filter(has_text='Laboratório Browser '+suffix)).to_have_count(0)
 expect(admin.locator('#aacd-network-grid .aacd-network-card').filter(has_text='Laboratório Browser '+suffix)).to_have_count(1)
 assert len(pending_reads)==reads_before+1,'Homologar deve atualizar os dois painéis com uma consulta aos pendentes.'
 login(partner,partner_email,ADMIN_PASSWORD);expect(partner.locator('#parceiro-inicio')).to_be_visible()
 card=partner.locator('#printer-grid .printer-card').filter(has_text='FDM Browser '+suffix);expect(card).to_be_visible()
 before=card.inner_text();card.get_by_role('button',name='Gerenciar',exact=True).click()
 expect(partner.locator('#parceiro-impressora')).to_be_visible()
 expect(partner.locator('#printer-form [name=materialsAvailable][value=PLA]')).to_be_checked()
 partner.get_by_role('button',name='Atualizar',exact=True).click();expect(partner.locator('#parceiro-inicio')).to_be_visible()
 assert card.inner_text()==before
 partner.reload();expect(partner.locator('#parceiro-inicio')).to_be_visible();expect(card).to_be_visible()
 for page in [admin,partner]:
  page.set_viewport_size({'width':390,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 partner.get_by_role('button',name='Laboratório Browser '+suffix,exact=True).click()
 partner.get_by_role('button',name='Sair da Conta',exact=True).click();expect(partner.locator('#login')).to_be_visible()
 partner.evaluate("location.hash='parceiro-inicio'");expect(partner.locator('#login')).to_be_visible()
 second_email='browser-second-'+suffix+'@example.org'
 body={'email':second_email,'password':ADMIN_PASSWORD,'phone':'61988887777','institution':'Segundo laboratório '+suffix,'responsible':'Outro responsável','street':'Via N2','number':'','city':'Brasília','state':'DF','latitude':-15.7939,'longitude':-47.8828,'locationConfirmed':True,'termsAccepted':True}
 created=partner.evaluate('''async(body)=>await (await import('./auth-client.js')).api('/auth/cadastros/parceiros',{method:'POST',body})''',body)
 admin.evaluate('''async(id)=>await (await import('./auth-client.js')).api('/parceiros/'+id+'/homologacao',{method:'POST'})''',created['user']['id'])
 partner.locator('#login [name=email]').fill(second_email);partner.locator('#login [name=password]').fill(ADMIN_PASSWORD)
 partner.get_by_role('button',name='Entrar no Sistema',exact=True).click();expect(partner.locator('#parceiro-inicio')).to_be_visible()
 partner.get_by_role('button',name='Segundo laboratório '+suffix,exact=True).click();partner.get_by_role('link',name='Editar a Conta',exact=True).click()
 expect(partner.locator('#parceiro-perfil')).to_be_visible();expect(partner.locator('#profile-institution')).to_have_value('Segundo laboratório '+suffix)
 location=partner.evaluate('''async()=> (await import('./location-ui.js')).locationValue('profile-location')''')
 assert abs(location['latitude']-body['latitude'])<0.000001 and abs(location['longitude']-body['longitude'])<0.000001
 partner.locator('#profile-phone').fill('61977776666');partner.get_by_role('button',name='Atualizar',exact=True).click()
 expect(partner.locator('#profile-feedback')).to_contain_text('atualizado')
 saved=partner.evaluate('''async()=> (await (await import('./auth-client.js')).api('/auth/me')).user''')
 assert saved['latitude']==body['latitude'] and saved['longitude']==body['longitude']
 partner.locator('#profile-institution').fill('Alteração que será cancelada')
 marker=partner.locator('#profile-location .leaflet-marker-icon');marker.focus();marker.press('ArrowRight')
 partner.locator('#cancel-profile').click();expect(partner.locator('#parceiro-inicio')).to_be_visible()
 partner.evaluate("location.hash='parceiro-perfil'");expect(partner.locator('#parceiro-perfil')).to_be_visible()
 expect(partner.locator('#profile-institution')).to_have_value(body['institution'])
 restored=partner.evaluate('''async()=> (await import('./location-ui.js')).locationValue('profile-location')''')
 assert restored['latitude']==body['latitude'] and restored['longitude']==body['longitude']
 assert not errors,errors
 browser.close()
 print('PASS: perfil do servidor, código gerado/manual, cadastro e homologação AACD, cadastro parceiro com mapa, Mongo persistente, edição sem alterações, logout e responsividade.')
