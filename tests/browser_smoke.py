"""Verifica o frontend sem registros e sem autenticação, simulando somente respostas HTTP.
Nenhum dado de demonstração é carregado pela aplicação.
"""

import functools
import http.server
import json
import shutil
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1] / "frontend"


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(
    ("127.0.0.1", 0), functools.partial(Handler, directory=str(root))
)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=shutil.which("chromium"),
            headless=True,
            args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def api(route):
            path = route.request.url.split("/api/", 1)[1]
            if path == "catalogos":
                route.fulfill(json={"unidades": ["Mooca"]})
            elif path == "auth/me":
                route.fulfill(
                    status=401, json={"error": {"message": "Entre na conta."}}
                )
            elif path == "auth/csrf":
                route.fulfill(json={"csrfToken": "token-de-teste"})
            else:
                route.fulfill(
                    status=503, json={"error": {"message": "Servidor indisponível."}}
                )

        page.route("**/api/**", api)
        page.route("https://cdn.userway.org/**", lambda route: route.abort())
        page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
        url = f"http://127.0.0.1:{server.server_port}/"
        page.goto(url)
        expect(page.locator("#sobre-nos")).to_be_visible()
        assert page.evaluate("""async () => {
            const fonts = await document.fonts.load('16px Jakarta');
            return fonts.length > 0 && fonts.every(font => font.status === 'loaded');
        }"""), "A fonte deve carregar a partir de frontend/assets."
        assert page.locator("[data-page]").count() == 20
        assert page.evaluate(
            """()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size}"""
        )
        for section in [
            "aacd-inicio",
            "parceiro-inicio",
            "aacd-pedidos",
            "parceiro-pedidos",
        ]:
            page.evaluate("(id)=>location.hash=id", section)
            expect(page.locator("#login")).to_be_visible()
        page.locator("#login [name=email]").fill("teste@example.org")
        page.locator("#login [name=password]").fill("SenhaApenasDeTeste")
        page.locator("#login button[type=submit]").click()
        expect(page.locator("#login-feedback")).to_contain_text("Servidor indisponível")
        expect(page.locator("#login")).to_be_visible()
        assert page.locator("#printer-grid .printer-card").count() == 0
        assert page.locator("#aacd-order-list .aacd-order-row").count() == 0
        assert page.locator("#aacd-match-list .aacd-match-card").count() == 0
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert not errors, errors
        browser.close()
        print(
            "PASS: sem dados de demonstração; login exige API; rotas protegidas bloqueadas; frontend sem erros JS e responsivo."
        )
finally:
    server.shutdown()
