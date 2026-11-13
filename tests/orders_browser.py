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

    def page_for(user):
        page = b.new_context().new_page()
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
    a.evaluate("location.hash='aacd-pedido-1'")
    a.locator("#aacd-order-code").fill(f["code"])
    a.locator("#aacd-order-step-1 button[type=submit]").click()
    for axis in "XYZ":
        a.locator("#aacd-volume" + axis).fill("50")
    a.locator("#aacd-order-step-2 [name=materials][value=PLA]").check()
    a.locator("#aacd-order-step-2 button[type=submit]").click()
    a.locator("#aacd-order-url").fill("https://example.org/modelo.stl")
    a.locator("#aacd-order-notes").fill("Instruções de teste")
    a.locator("#aacd-order-step-3 button[type=submit]").click()
    expect(a.locator("#aacd-conectar")).to_be_visible()
    card = a.locator(".aacd-match-card").filter(has_text=f["partner"]["nome"]).first
    expect(card).to_contain_text("km")
    card.locator("[data-connect-order]").click()
    expect(a.locator("#aacd-pedidos")).to_be_visible()
    expect(a.locator("#aacd-orders-feedback")).to_contain_text("salvo")
    a.reload()
    expect(a.locator("#aacd-order-list")).to_contain_text(f["code"])
    partner = page_for(f["partner"])
    partner.evaluate("location.hash='parceiro-pedidos'")
    order = partner.locator("#pending-orders .order-card").filter(has_text=f["code"])
    expect(order).to_be_visible()
    order.locator("[data-order-action=refuse]").click()
    expect(order).to_have_count(0)
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
    order.locator("[data-order-action=accept]").click()
    active = partner.locator("#active-orders .order-card").filter(has_text=f["code"])
    expect(active).to_be_visible()
    active.locator("[data-order-action=complete]").click()
    expect(active).to_have_count(0)
    partner.reload()
    partner.evaluate("location.hash='parceiro-inicio'")
    expect(partner.locator("#production-history")).to_contain_text(f["code"])
    a.reload()
    expect(a.locator("#aacd-order-list")).to_contain_text("Finalizado")
    assert not errors, errors
    print(
        "PASS: Chromium conectado; criação, persistência após reload, recusa, reencaminhamento, aceite, finalização e histórico sem erros JS."
    )
    b.close()
