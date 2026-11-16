"""Paginação, filtros e CSV com pedidos reais nos bancos descartáveis de teste."""

import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

if os.environ.get("NODE_ENV") != "test":
    raise SystemExit("Use NODE_ENV=test e bancos descartáveis.")
fixture = json.loads(
    Path(
        os.environ.get(
            "CONEXO_ORDERS_FIXTURE",
            str(Path(tempfile.gettempdir()) / "conexo-orders-browser-fixture.json"),
        )
    ).read_text()
)
url = os.environ.get("CONEXO_BACKEND_URL", "http://localhost:3001/").rstrip("/")

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_PATH") or shutil.which("chromium"),
        headless=True,
        args=["--no-sandbox"],
    )
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("https://cdn.userway.org/**", lambda route: route.abort())
    page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
    page.goto(url + "/#login")
    page.locator("#login [name=email]").fill(fixture["aacd"]["email"])
    page.locator("#login [name=password]").fill(fixture["password"])
    page.locator("#login [type=submit]").click()
    expect(page.locator("#aacd-inicio")).to_be_visible()
    prefix = "PAGINACAO-" + uuid.uuid4().hex
    page.evaluate(
        """async ({prefix, partnerId, printerId}) => {
        const {api} = await import('./auth-client.js');
        for (let index = 1; index <= 5; index++) {
            await api('/pedidos', {method:'POST', body: {
                request: {
                    code: prefix + '-' + index,
                    priority: index === 5 ? 'Urgente' : 'Padrão',
                    volumes: {X:20,Y:20,Z:20}, materials:['PLA'], nozzles:[0.4],
                    url:'https://example.org/modelo.stl', notes:''
                },
                selection: {partnerId,printerId,material:'PLA',nozzle:0.4}
            }});
        }
        document.dispatchEvent(new CustomEvent('conexo:data-changed'));
        location.hash='aacd-pedidos';
    }""",
        {
            "prefix": prefix,
            "partnerId": fixture["partner"]["id"],
            "printerId": fixture["printer"]["_id"],
        },
    )
    page.locator("#aacd-order-search").fill(prefix)
    rows = page.locator("#aacd-order-list .aacd-order-row")
    expect(page.locator("#aacd-order-count")).to_have_text(
        "Exibindo 4 de 5 pedidos encontrados"
    )
    expect(rows).to_have_count(4)
    expect(rows.first.locator("[data-order-code]")).to_contain_text(prefix + "-5")
    page.locator("[data-aacd-page=next]").click()
    expect(rows).to_have_count(1)
    expect(rows.locator("[data-order-code]")).to_contain_text(prefix + "-1")
    rows.locator("[data-aacd-detail]").click()
    expect(rows.locator(".aacd-order-detail")).to_be_visible()
    page.locator("[data-aacd-page=previous]").click()
    expect(rows).to_have_count(4)
    page.locator("[data-aacd-page=next]").click()
    expect(rows.locator(".aacd-order-detail")).to_be_visible()

    # O CSV inclui todos os resultados filtrados, inclusive os de outra página.
    with page.expect_download() as downloaded:
        page.locator("#aacd-export").click()
    csv = Path(downloaded.value.path()).read_text(encoding="utf-8-sig")
    assert len(csv.splitlines()) == 6
    assert all(prefix + "-" + str(index) in csv for index in range(1, 6))

    page.locator('[data-bs-target="#aacd-order-filters"]').click()
    page.locator("#aacd-filter-priority").select_option("Urgente")
    expect(rows).to_have_count(1)
    expect(rows.locator("[data-order-code]")).to_contain_text(prefix + "-5")
    expect(page.locator('[data-aacd-page="1"]')).to_have_attribute(
        "aria-current", "page"
    )
    page.locator("#aacd-filter-material").select_option("PETG")
    expect(rows).to_have_count(0)
    expect(page.locator("#aacd-order-empty")).to_be_visible()
    page.locator("#aacd-filter-material").select_option("")
    page.locator("#aacd-filter-priority").select_option("")
    page.locator('[data-aacd-tab="finalizado"]').click()
    expect(rows).to_have_count(0)
    page.locator('[data-aacd-tab="não aceito"]').click()
    expect(rows).to_have_count(4)
    page.locator("[data-aacd-page=next]").click()
    expect(rows).to_have_count(1)
    rows.locator("[data-cancel-order]").click()
    expect(page.locator("#aacd-orders-feedback")).to_contain_text("cancelado")
    expect(rows).to_have_count(4)
    expect(page.locator("#aacd-order-count")).to_have_text(
        "Exibindo 4 de 4 pedidos encontrados"
    )
    expect(page.locator("[data-aacd-page=next]")).to_be_disabled()
    assert not errors, errors
    browser.close()
    print(
        "PASS: quatro cards por página, filtros, detalhes preservados, CSV completo e cancelamento na última página."
    )
