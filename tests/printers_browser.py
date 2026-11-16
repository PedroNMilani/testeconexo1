"""Criação, edição e remoção de impressoras usando somente os bancos de teste."""

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
    requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: requests.append((request.method, request.url)))
    page.route("https://cdn.userway.org/**", lambda route: route.abort())
    page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
    page.goto(url + "/#login")
    page.locator("#login [name=email]").fill(fixture["partner"]["email"])
    page.locator("#login [name=password]").fill(fixture["password"])
    page.locator("#login [type=submit]").click()
    expect(page.locator("#parceiro-inicio")).to_be_visible()
    card = page.locator(
        f'#printer-grid [data-printer-id="{fixture["printer"]["_id"]}"]'
    )
    card.locator(".manage-printer").click()
    expect(page.locator("#parceiro-impressora")).to_be_visible()
    page.locator("#printer-form [name=edit-volumeX]").fill("205")
    page.locator("#printer-form [name=materials][value=PETG]").check()
    page.locator("#save-printer").click()
    expect(page.locator("#parceiro-inicio")).to_be_visible()
    expect(card.locator("[data-printer-material]")).to_contain_text("PETG")
    endpoint = url + "/api/impressoras/" + fixture["printer"]["_id"]
    assert (
        requests.count(("GET", endpoint)) == 1
    ), "Salvar não deve buscar novamente a impressora."
    assert requests.count(("PATCH", endpoint)) == 1
    page.reload()
    card.locator(".manage-printer").click()
    expect(page.locator("#printer-form [name=edit-volumeX]")).to_have_value("205")
    expect(page.locator("#printer-form [name=materials][value=PETG]")).to_be_checked()
    expect(page.locator("#editor-name")).to_have_text(fixture["printer"]["modelo"])
    page.evaluate("location.hash='parceiro-inicio'")

    name = "FDM teste " + uuid.uuid4().hex
    page.locator("#add-printer").click()
    page.locator("#new-printer-name").fill(name)
    for axis in "XYZ":
        page.locator("#printer-form [name=edit-volume" + axis + "]").fill("100")
    page.locator("#printer-form [name=materials][value=PLA]").check()
    page.locator("#printer-form [name=materialsAvailable][value=PLA]").check()
    page.locator("#save-printer").click()
    expect(page.locator("#parceiro-inicio")).to_be_visible()
    created = page.locator("#printer-grid .printer-card").filter(has_text=name)
    expect(created).to_be_visible()
    created.locator(".manage-printer").click()
    page.locator("#remove-printer").click()
    expect(page.locator("#parceiro-inicio")).to_be_visible()
    expect(created).to_have_count(0)
    expect(card).to_be_visible()
    page.reload()
    expect(created).to_have_count(0)
    expect(card).to_be_visible()
    page.evaluate("async()=>await (await import('./js/auth-client.js')).logout()")
    expect(page.locator("#printer-grid .printer-card")).to_have_count(0)
    expect(page.locator("#new-printer-name")).to_have_value("")
    assert not errors, errors
    browser.close()
    print(
        "PASS: edição com uma consulta, dimensões e materiais persistidos, criação, remoção e limpeza ao sair."
    )
