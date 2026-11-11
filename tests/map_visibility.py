"""Regressão de visibilidade do mapa: prévia estática e API de catálogos lenta.
Não usa banco; imagens externas são bloqueadas para testar também o aviso de falha.
"""
import functools,http.server,threading,shutil,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):
  # Reproduz a política do Express, que omite Referer para outros sites.
  self.send_header('Referrer-Policy','same-origin')
  super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  for backend in [False,True]:
   context=browser.new_context(viewport={'width':1000,'height':850});held=[];errors=[];tile_headers=[]
   context.route('https://cdn.userway.org/**',lambda route:route.abort('blockedbyclient'))
   def capture_tile(route):
    tile_headers.append(route.request.all_headers())
    route.abort('blockedbyclient')
   context.route('https://tile.openstreetmap.org/**',capture_tile)
   if backend:
    context.route('**/runtime-config.js',lambda route:route.fulfill(content_type='application/javascript',body='globalThis.CONEXO_CONFIG={backend:true};'))
    context.route('**/api/catalogos',lambda route:held.append(route))
    context.route('**/api/auth/me',lambda route:route.fulfill(status=401,content_type='application/json',body='{"error":{"message":"Entre na conta"}}'))
   page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
   page.goto(f'http://127.0.0.1:{server.server_port}/?map_referrer_check=private',wait_until='domcontentloaded')
   expect(page.locator('#registration-location [data-map]')).to_have_class(re.compile('leaflet-container'))
   page.get_by_role('link',name='Colabore conosco!',exact=True).click()
   expect(page.locator('#termos-uso')).to_be_visible()
   page.locator('#termos-uso-terms-scroll').evaluate('(el)=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"))}')
   page.locator('#termos-uso-confirm-terms').click()
   page.evaluate("location.hash='parceiro-logistica'")
   expect(page.locator('#parceiro-logistica')).to_be_visible()
   box=page.locator('#registration-location')
   expect(box,'A etapa de localização deve mostrar o mapa e seus controles.').to_be_visible()
   canvas=box.locator('[data-map]');expect(canvas).to_have_class(re.compile('leaflet-container'))
   assert canvas.bounding_box()['height']>=250
   expect(box.locator('.leaflet-marker-icon')).to_be_visible()
   expect(box.locator('[data-geocode]')).to_be_visible()
   if not backend:expect(box.locator('[data-geocode]')).to_be_disabled()
   else:assert held,'O catálogo deve continuar pendente enquanto o mapa já está visível.'
   canvas.click(position={'x':canvas.bounding_box()['width']/2+35,'y':canvas.bounding_box()['height']/2+20})
   box.locator('[data-confirm-location]').check()
   assert page.evaluate("async()=> (await import('./location-ui.js')).locationValue('registration-location').locationConfirmed")
   page.set_viewport_size({'width':390,'height':844})
   expect(box.locator('.leaflet-marker-icon')).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # OSM exige Referer válido; enviar somente a origem preserva o caminho privado.
   origin=f'http://127.0.0.1:{server.server_port}/'
   assert tile_headers,'O mapa deve solicitar imagens.'
   assert all(headers.get('referer')==origin for headers in tile_headers), 'As imagens do OSM precisam receber apenas a origem no Referer.'
   if backend:
    with page.expect_response('**/api/auth/me'):
     held[0].fulfill(content_type='application/json',body='{"unidades":["Mooca"]}')
   assert not errors,errors
   context.close()
   print('PASS: mapa visível, utilizável e Referer limitado à origem em '+('backend com catálogo pendente' if backend else 'servidor estático (Live Server)'),flush=True)
  browser.close()
finally:server.shutdown()
