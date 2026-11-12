from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os
import shutil

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
        headless=True,
        args=['--no-sandbox'],
    )
    page = browser.new_page()
    page.route('https://tile.openstreetmap.org/**', lambda route: route.abort())
    page.set_content('''<section data-page><input id="street" value="Paulista"><input id="city" value="São Paulo"><input id="state" value="SP"><div id="location"><button data-geocode>Localizar</button><div data-map style="height:400px;width:600px"></div><input type="checkbox" data-confirm-location><p data-location-feedback></p></div></section>''')
    page.add_style_tag(path=str(root / 'vendor/leaflet/leaflet.css'))
    page.add_script_tag(path=str(root / 'vendor/leaflet/leaflet.js'))
    source = (root / 'location-ui.js').read_text().replace("import { api, backendEnabled } from './auth-client.js';", '''const backendEnabled = true;
    const api = async () => {
      if (window.failure) throw Object.assign(new Error('Falha'), {code: window.failure});
      return {latitude:-23.55,longitude:-46.63,nivel:window.level || 'rua'};
    };''').replace('export function ', 'function ')
    page.add_script_tag(content=source + "\nmountLocation('location', {street:'#street',city:'#city',state:'#state'});window.readLocation=()=>locationValue('location');")
    confirm = page.locator('[data-confirm-location]')
    expect(confirm).to_be_disabled()
    page.evaluate("window.failure='GEOCODING_UNAVAILABLE'")
    page.locator('[data-geocode]').click()
    expect(page.locator('[data-location-feedback]')).to_contain_text('indisponível')
    expect(confirm).to_be_disabled()
    page.evaluate("window.failure=null;window.level='cidade'")
    page.locator('[data-geocode]').click()
    expect(page.locator('[data-location-feedback]')).to_contain_text('apenas a cidade')
    expect(confirm).to_be_disabled()
    page.locator('[data-map]').click(position={'x':350,'y':210})
    expect(confirm).to_be_enabled()
    confirm.check()
    assert page.evaluate('window.readLocation().locationConfirmed')
    page.locator('#street').fill('Outra rua')
    expect(confirm).to_be_disabled()
    expect(confirm).not_to_be_checked()
    page.evaluate("window.level='rua'")
    page.locator('[data-geocode]').click()
    expect(confirm).to_be_enabled()
    expect(confirm).not_to_be_checked()
    confirm.check()
    assert page.evaluate('window.readLocation().locationConfirmed')
    browser.close()
    print('PASS: Chromium com Leaflet real; falha bloqueia confirmação, cidade exige ajuste, rua libera confirmação e editar endereço invalida.')
