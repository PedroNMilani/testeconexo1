"""Fluxo de pedidos conectado. Requer fixture gerada em bancos descartáveis.
Veja backend/README.md. Não usa contas reais nem serviços externos.
"""

from playwright.sync_api import sync_playwright, expect
import json, os, shutil, tempfile
from pathlib import Path

if os.environ.get("NODE_ENV") != "test":
    raise SystemExit("Use NODE_ENV=test e bancos descartáveis.")
f = json.loads(
    Path(
        os.environ.get(
            "CONEXO_ORDERS_FIXTURE",
            str(Path(tempfile.gettempdir()) / "conexo-orders-browser-fixture.json"),
        )
    ).read_text()
)
URL = os.environ.get("CONEXO_BACKEND_URL", "http://localhost:3001/").rstrip("/")
with sync_playwright() as p:
    b = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_PATH") or shutil.which("chromium"),
        headless=True,
        args=["--no-sandbox"],
    )
    errors = []
    order_reads = {}

    def page_for(user):
        page = b.new_context().new_page()
        order_reads[page] = 0

        def count_orders(request):
            if request.method == "GET" and request.url == URL + "/api/pedidos":
                order_reads[page] += 1

        page.on("request", count_orders)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("https://cdn.userway.org/**", lambda r: r.abort())
        page.route("https://tile.openstreetmap.org/**", lambda r: r.abort())
        page.goto(URL + "/#login")
        page.locator("#login [name=email]").fill(user["email"])
        page.locator("#login [name=password]").fill(f["password"])
        page.locator("#login button[type=submit]").click()
        expect(
            page.locator(
                "#" + ("aacd-inicio" if user["perfil"] == "aacd" else "parceiro-inicio")
            )
        ).to_be_visible()
        return page

    a = page_for(f["aacd"])
    # Alterar a ordem visual não pode trocar os valores preenchidos no card.
    a.evaluate("""() => {
        const template = document.getElementById('match-template').content;
        const specs = template.querySelector('.match-specs');
        specs.prepend(specs.lastElementChild);
    }""")
    a.evaluate("location.hash='aacd-pedido-1'")
    a.locator("#aacd-order-code").fill(f["code"])
    a.locator("#aacd-order-step-1 button[type=submit]").click()
    expect(a.locator("#aacd-order-step-2 [name=nozzles]:checked")).to_have_count(4)
    a.locator('#aacd-order-step-2 [name=nozzles][value="0.2"]').uncheck()
    a.locator("#aacd-order-step-2").evaluate("(form)=>form.reset()")
    expect(a.locator("#aacd-order-step-2 [name=nozzles]:checked")).to_have_count(4)
    for axis in "XYZ":
        a.locator("#aacd-volume" + axis).fill("50")
    a.locator("#aacd-order-step-2 [name=materials][value=PLA]").check()
    a.locator("#aacd-order-step-2 button[type=submit]").click()
    a.locator("#aacd-order-url").fill("https://example.org/modelo.stl")
    a.locator("#aacd-order-notes").fill("Instruções de teste")
    a.route(
        "**/api/recomendacoes",
        lambda route: route.fulfill(
            status=503, json={"error": {"message": "Falha de recomendações para teste"}}
        ),
    )
    a.locator("#aacd-order-step-3 button[type=submit]").click()
    expect(a.locator("#aacd-order-step-3 .form-error")).to_have_text(
        "Falha de recomendações para teste"
    )
    a.unroute("**/api/recomendacoes")
    a.locator("#aacd-order-step-3 button[type=submit]").click()
    expect(a.locator("#aacd-conectar")).to_be_visible()
    card = a.locator(".aacd-match-card").filter(has_text=f["partner"]["nome"]).first
    expect(card.locator(".match-score > span")).to_have_text("Distância em linha reta")
    expect(card.locator("[data-match-distance]")).to_contain_text("km")
    expect(card.locator(".match-score img")).to_have_count(0)
    expect(card.locator("[data-match-printer]")).to_have_text(f["printer"]["modelo"])
    expect(card.locator("[data-match-material]")).to_have_text("PLA • bico 0.4 mm")
    expect(card.locator("[data-match-supply]")).to_have_text("Material disponível")
    card.locator("[data-match-detail]").click()
    expect(card.locator("[data-match-detail-printer]")).to_contain_text(
        f["printer"]["modelo"]
    )
    card.locator("[data-connect-order]").click()
    expect(a.locator("#aacd-pedidos")).to_be_visible()
    expect(a.locator("#aacd-orders-feedback")).to_contain_text("salvo")
    a.reload()
    expect(a.locator("#aacd-order-list")).to_contain_text(f["code"])
    partner = page_for(f["partner"])
    expect(
        partner.locator("#pending-orders .order-card").filter(has_text=f["code"])
    ).to_have_count(1)
    assert (
        order_reads[partner] == 1
    ), "O login deve carregar a lista de pedidos uma vez."
    partner.evaluate("""() => {
        for (const id of ['pending-order-template', 'active-order-template']) {
            const template = document.getElementById(id).content;
            const fields = template.querySelector('.order-data');
            fields.prepend(fields.lastElementChild);
            const details = template.querySelector('.order-extra');
            details.prepend(details.lastElementChild);
        }
        document.dispatchEvent(new CustomEvent('conexo:data-changed'));
    }""")
    partner.evaluate("location.hash='parceiro-pedidos'")
    order = partner.locator("#pending-orders .order-card").filter(has_text=f["code"])
    expect(order).to_be_visible()
    expect(order.locator("[data-order-device]")).to_have_text(f["code"])
    expect(order.locator("[data-order-material]")).to_have_text("PLA")
    order.locator("[data-order-action=details]").click()
    expect(order.locator("[data-order-detail-code]")).to_contain_text(f["code"])
    expect(order.locator("[data-order-detail-material]")).to_contain_text("PLA")
    reads_before = order_reads[partner]
    partner.route(
        "**/api/pedidos/*/acoes/recusar",
        lambda route: route.fulfill(
            status=503, json={"error": {"message": "Falha temporária ao recusar"}}
        ),
    )
    order.locator("[data-order-action=refuse]").click()
    expect(partner.locator("#orders-feedback")).to_have_text(
        "Falha temporária ao recusar"
    )
    expect(order.locator("[data-order-action=refuse]")).to_be_enabled()
    expect(order).to_be_visible()
    assert order_reads[partner] == reads_before
    partner.unroute("**/api/pedidos/*/acoes/recusar")
    order.locator("[data-order-action=refuse]").click()
    expect(order).to_have_count(0)
    expect(partner.locator("#orders-feedback")).to_contain_text("recusado")
    expect(partner.locator("#production-history")).to_contain_text(f["code"])
    assert order_reads[partner] == reads_before + 1
    a.reload()
    expect(a.locator("#aacd-open-requests")).to_be_visible()
    request = a.locator("#aacd-open-requests article").filter(has_text=f["code"])
    request.get_by_role("button", name="Selecionar parceiro").click()
    expect(a.locator("#aacd-conectar")).to_be_visible()
    a.locator(".aacd-match-card").filter(has_text=f["partner"]["nome"]).first.locator(
        "[data-connect-order]"
    ).click()
    expect(a.locator("#aacd-pedidos")).to_be_visible()
    partner.reload()
    order = partner.locator("#pending-orders .order-card").filter(has_text=f["code"])
    expect(order).to_be_visible()
    reads_before = order_reads[partner]
    order.locator("[data-order-action=accept]").click()
    active = partner.locator("#active-orders .order-card").filter(has_text=f["code"])
    expect(active).to_be_visible()
    expect(partner.locator("#orders-feedback")).to_contain_text("aceito")
    assert order_reads[partner] == reads_before + 1
    reads_before = order_reads[partner]
    active.locator("[data-order-action=complete]").click()
    expect(active).to_have_count(0)
    expect(partner.locator("#orders-feedback")).to_contain_text("concluído")
    assert order_reads[partner] == reads_before + 1
    partner.reload()
    partner.evaluate("location.hash='parceiro-inicio'")
    expect(partner.locator("#production-history")).to_contain_text(f["code"])
    a.reload()
    expect(a.locator("#aacd-order-list")).to_contain_text("Finalizado")
    partner.evaluate("async()=>await (await import('./js/auth-client.js')).logout()")
    expect(partner.locator("#production-history .history-row")).to_have_count(0)
    expect(partner.locator("#pending-orders-count")).to_have_text("0")
    expect(partner.locator("#active-orders-count")).to_have_text("0")
    a.locator('#aacd-order-step-2 [name=nozzles][value="0.2"]').evaluate(
        "(input)=>input.checked=false"
    )
    a.evaluate("async()=>await (await import('./js/auth-client.js')).logout()")
    expect(a.locator("#aacd-order-step-2 [name=nozzles]:checked")).to_have_count(4)
    assert not errors, errors
    print(
        "PASS: Chromium conectado; criação, persistência após reload, recusa, reencaminhamento, aceite, finalização e histórico sem erros JS."
    )
    b.close()
