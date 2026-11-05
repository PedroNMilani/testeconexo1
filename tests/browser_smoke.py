from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import os, shutil
URL=os.environ.get('CONEXO_TEST_URL', 'http://localhost:8000/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL)
 assert page.locator('[data-page]').count()==20
 assert page.evaluate('''()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size}''')
 assert page.evaluate('''()=>[...document.querySelectorAll('label[for]')].every(e=>document.getElementById(e.htmlFor))''')
 page.get_by_role('link',name='Entrar',exact=True).click()
 page.locator('#login [name="email"]').fill('equipe@aacd.org.br')
 page.locator('#login [name="password"]').fill('Teste1234')
 page.get_by_role('button',name='Entrar no Sistema').click()
 expect(page.locator('#aacd-inicio')).to_be_visible()
 assert page.locator('#aacd-header').is_visible()
 assert not page.locator('#partner-header').is_visible()
 sections=['aacd-inicio','aacd-pedidos','aacd-parceiros','aacd-homologacao','aacd-pedido-1','aacd-pedido-2','aacd-pedido-3','aacd-conectar','aacd-perfil']
 for section in sections:
  page.evaluate('(id)=>location.hash=id',section)
  expect(page.locator('#'+section)).to_be_visible()
 page.evaluate("location.hash='aacd-pedidos'")
 expect(page.locator('#aacd-pedidos')).to_be_visible()
 page.get_by_role('button',name='Em Produção',exact=True).click()
 assert page.locator('#aacd-order-list .aacd-order-row:visible').count()==1
 page.get_by_role('button',name='Entregues',exact=True).click()
 assert page.locator('#aacd-order-list .aacd-order-row:visible').count()==2
 page.get_by_role('button',name='Todos',exact=True).click()
 page.locator('#aacd-order-search').fill('1090')
 assert page.locator('#aacd-order-list .aacd-order-row:visible').count()==1
 page.locator('[data-aacd-order="1090"] [data-aacd-detail]').click()
 expect(page.locator('#aacd-order-detail-1090')).to_be_visible()
 with page.expect_download() as d:page.get_by_role('button',name='Exportar CSV',exact=True).click()
 download=d.value
 assert '1090' in Path(download.path()).read_text(encoding='utf-8-sig')
 page.locator('#aacd-order-search').fill('sem resultado')
 expect(page.locator('#aacd-order-empty')).to_be_visible()
 page.locator('#aacd-order-search').fill('')
 page.get_by_role('button',name='Filtros',exact=True).click()
 expect(page.locator('#aacd-filter-material')).to_be_visible()
 page.locator('#aacd-filter-material').select_option(label='PETG')
 assert page.locator('#aacd-order-list .aacd-order-row:visible').count()==1
 page.get_by_role('button',name='Limpar filtros',exact=True).click()
 page.evaluate("location.hash='aacd-parceiros'")
 expect(page.locator('#aacd-parceiros')).to_be_visible()
 page.locator('#aacd-partner-search').fill('Santos')
 assert page.locator('.aacd-network-card:visible').count()==1
 page.locator('#aacd-partner-search').fill('')
 page.get_by_role('link',name='Ver Solicitações',exact=True).click()
 expect(page.locator('#aacd-homologacao')).to_be_visible()
 page.locator('.aacd-review').first.locator('summary').click()
 page.get_by_role('button',name='Homologar Parceiro Técnico',exact=True).click()
 assert page.locator('.aacd-review').count()==3
 assert page.locator('.aacd-network-card').count()==5
 page.locator('.aacd-review').first.locator('summary').click()
 page.get_by_role('button',name='Rejeitar Cadastro',exact=True).click()
 assert page.locator('.aacd-review').count()==2
 page.evaluate("location.hash='aacd-inicio'")
 expect(page.locator('#aacd-inicio')).to_be_visible()
 page.get_by_role('link',name='Iniciar Especificação Técnica',exact=True).click()
 expect(page.locator('#aacd-pedido-1')).to_be_visible()
 page.locator('#aacd-order-code').fill('#TESTE-AACD-1')
 page.get_by_text('Urgente',exact=True).last.click()
 page.get_by_role('button',name='Avançar',exact=True).click()
 expect(page.locator('#aacd-pedido-2')).to_be_visible()
 for axis in ['X','Y','Z']:page.locator('#aacd-volume'+axis).fill('200')
 page.get_by_role('button',name='Avançar',exact=True).click()
 assert page.locator('#aacd-order-step-2 .form-error').inner_text()
 page.locator('#aacd-order-step-2 [value="PLA"]').check()
 page.get_by_role('button',name='Avançar',exact=True).click()
 expect(page.locator('#aacd-pedido-3')).to_be_visible()
 page.go_back()
 expect(page.locator('#aacd-pedido-2')).to_be_visible()
 assert page.locator('#aacd-volumeX').input_value()=='200'
 assert page.locator('#aacd-order-step-2 [value="PLA"]').is_checked()
 page.get_by_role('button',name='Avançar',exact=True).click()
 page.locator('#aacd-order-url').fill('ftp://exemplo.com/arquivo.stl')
 page.get_by_role('button',name='Avançar',exact=True).click()
 assert page.locator('#aacd-order-url').evaluate('(e)=>e.validity.customError')
 page.locator('#aacd-order-url').fill('https://example.com/arquivo.stl')
 page.locator('#aacd-order-notes').fill('Sem rebarbas para contato dérmico.')
 page.get_by_role('button',name='Avançar',exact=True).click()
 expect(page.locator('#aacd-conectar')).to_be_visible()
 assert page.locator('#aacd-demand-code').inner_text()=='#TESTE-AACD-1'
 assert page.locator('#aacd-demand-volume').inner_text()=='200×200×200 mm'
 page.locator('[data-match="0"] [data-match-detail]').click()
 expect(page.locator('#match-detail-0')).to_be_visible()
 page.locator('[data-connect-order="0"]').click()
 expect(page.locator('#aacd-pedidos')).to_be_visible()
 assert page.locator('#aacd-order-list .aacd-order-row').count()==5
 assert 'TESTE-AACD' in page.locator('#aacd-order-list .aacd-order-row').first.inner_text()
 assert not page.locator('[data-aacd-page="2"]').is_disabled()
 page.locator('[data-aacd-page="2"]').click()
 assert page.locator('#aacd-order-list .aacd-order-row:visible').count()==1
 page.evaluate("location.hash='aacd-conectar'")
 expect(page.locator('#aacd-conectar')).to_be_visible()
 page.locator('[data-connect-order="0"]').click()
 assert 'já foi conectado' in page.locator('#aacd-connect-feedback').inner_text()
 assert page.locator('#aacd-order-list .aacd-order-row').count()==5
 page.get_by_role('button',name='Pedro - AACD',exact=True).click()
 page.get_by_role('link',name='Editar a Conta',exact=True).click()
 expect(page.locator('#aacd-perfil')).to_be_visible()
 page.locator('#aacd-profile-unit').select_option(label='Mooca')
 for id,value in {'aacd-profile-name':'Equipe AACD','aacd-profile-email':'equipe@aacd.org.br','aacd-profile-phone':'11988887777'}.items():page.locator('#'+id).fill(value)
 page.get_by_role('button',name='Atualizar',exact=True).click()
 assert page.locator('[data-aacd-account]').inner_text()=='Equipe AACD'
 page.locator('#aacd-profile-name').fill('Rascunho')
 page.get_by_role('button',name='Cancelar',exact=True).click()
 expect(page.locator('#aacd-inicio')).to_be_visible()
 assert page.locator('#aacd-profile-name').input_value()=='Equipe AACD'
 page.get_by_role('button',name='Equipe AACD',exact=True).click()
 page.get_by_role('button',name='Sair da Conta',exact=True).click()
 expect(page.locator('#login')).to_be_visible()
 assert page.locator('#login [name="password"]').input_value()==''
 # Hover e foco no lápis de cada impressora existente.
 page.evaluate("location.hash='parceiro-inicio'")
 expect(page.locator('#parceiro-inicio')).to_be_visible()
 page.mouse.move(0,0)
 for id in ['1','2','3']:
  card=page.locator(f'[data-printer-id="{id}"]')
  button=card.locator('.edit-printer')
  expect(button).to_have_css('opacity','0')
  card.hover()
  expect(button).to_have_css('opacity','1')
  button.click()
  expect(page.locator('#parceiro-impressora')).to_be_visible()
  assert page.locator('#editor-name').inner_text()==card.locator('h3').inner_text()
  page.evaluate("location.hash='parceiro-inicio'")
  expect(page.locator('#parceiro-inicio')).to_be_visible()
  page.mouse.move(0,0)
  page.locator('#parceiro-inicio-titulo').focus()
 page.locator('[data-printer-id="2"] .edit-printer').focus()
 expect(page.locator('[data-printer-id="2"] .edit-printer')).to_have_css('opacity','1')
 page.get_by_role('button',name='Adicionar impressora',exact=True).click()
 page.locator('#new-printer-name').fill('Prusa Teste')
 for axis in ['X','Y','Z']:page.locator('#edit-volume'+axis).fill('200')
 page.locator('#printer-form [value="PLA"]').check()
 page.locator('#edit-needs-material').select_option(label='Não')
 page.get_by_role('button',name='Adicionar',exact=True).click()
 expect(page.locator('#parceiro-inicio')).to_be_visible()
 card=page.locator('[data-printer-id="4"]');card.hover()
 expect(card.locator('.edit-printer')).to_have_css('opacity','1')
 card.locator('.edit-printer').click()
 assert page.locator('#editor-name').inner_text()=='Prusa Teste'
 # Estrutura e geometria em desktop e celular.
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':844})
  for section in sections:
   page.evaluate('(id)=>location.hash=id',section)
   expect(page.locator('#'+section)).to_be_visible()
   assert page.locator('[data-page]:visible').count()==1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(section,width)
   assert page.locator('[data-page]:visible img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)'),section
 assert not errors,errors
 touch=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 mobile=touch.new_page();mobile.goto(URL+'#parceiro-inicio')
 expect(mobile.locator('[data-printer-id="1"] .edit-printer')).to_have_css('opacity','1')
 print('PASS: AACD login, 9 seções, histórico, busca, filtros, CSV, rede, homologação, 3 etapas, URL, conexão sem duplicação, perfil, conta, hover/foco/toque e lápis em novas impressoras, imagens e responsividade.')
 b.close()
