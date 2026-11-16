"""Teste de interface com catálogo da API pendente; o servidor HTTP é apenas da suíte.
Não existe modo de execução da aplicação com backend desativado.
"""

import functools
import http.server
import re
import shutil
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()


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
        context = browser.new_context(viewport={"width": 1000, "height": 850})
        held, errors, tile_headers = [], [], []
        context.route("https://cdn.userway.org/**", lambda route: route.abort())

        def capture_tile(route):
            tile_headers.append(route.request.all_headers())
            route.abort()

        context.route("https://tile.openstreetmap.org/**", capture_tile)
        context.route(
            "**/api/auth/csrf", lambda route: route.fulfill(json={"csrfToken": "teste"})
        )
        context.route(
            "**/api/localizacoes/geocodificar",
            lambda route: route.fulfill(
                json={"latitude": -23.55, "longitude": -46.63, "nivel": "rua"}
            ),
        )
        context.route("**/api/catalogos", lambda route: held.append(route))
        context.route(
            "**/api/auth/me",
            lambda route: route.fulfill(
                status=401, json={"error": {"message": "Entre na conta"}}
            ),
        )
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(
            f"http://127.0.0.1:{server.server_port}/?map_referrer_check=private",
            wait_until="domcontentloaded",
        )
        expect(page.locator("#registration-location [data-map]")).to_have_class(
            re.compile("leaflet-container")
        )
        page.get_by_role("link", name="Colabore conosco!", exact=True).click()
        expect(page.locator("#termos-uso")).to_be_visible()
        page.locator("#termos-uso-terms-scroll").evaluate(
            '(el)=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll"))}'
        )
        page.locator("#termos-uso-confirm-terms").click()
        page.evaluate("location.hash='parceiro-logistica'")
        expect(page.locator("#parceiro-logistica")).to_be_visible()
        box = page.locator("#registration-location")
        expect(box).to_be_visible()
        canvas = box.locator("[data-map]")
        assert canvas.bounding_box()["height"] >= 250
        expect(box.locator(".leaflet-marker-icon")).to_be_visible()
        assert held, "O catálogo deve continuar pendente enquanto o mapa está visível."
        box.locator("[data-geocode]").click()
        expect(box.locator("[data-confirm-location]")).to_be_enabled()
        canvas.click(
            position={
                "x": canvas.bounding_box()["width"] / 2 + 35,
                "y": canvas.bounding_box()["height"] / 2 + 20,
            }
        )
        box.locator("[data-confirm-location]").check()
        assert page.evaluate(
            "async()=> (await import('./location-ui.js')).locationValue('registration-location').locationConfirmed"
        )
        page.set_viewport_size({"width": 390, "height": 844})
        expect(box.locator(".leaflet-marker-icon")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        origin = f"http://127.0.0.1:{server.server_port}/"
        assert tile_headers
        assert all(headers.get("referer") == origin for headers in tile_headers)
        with page.expect_response("**/api/auth/me"):
            held[0].fulfill(json={"unidades": ["Mooca"]})
        assert not errors, errors
        browser.close()
        print(
            "PASS: mapa visível com API pendente; busca, confirmação e Referer limitado à origem."
        )
finally:
    server.shutdown()
