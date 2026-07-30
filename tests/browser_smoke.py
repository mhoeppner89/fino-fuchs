#!/usr/bin/env python3
"""End-to-end smoke tests for Fino schreibt.

Requires: pip install playwright && playwright install chromium
The script also accepts CHROMIUM_PATH=/path/to/chromium.
"""

from __future__ import annotations

import functools
import http.server
import os
from pathlib import Path
import shutil
import threading
from typing import Any

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "test-artifacts"
ARTIFACTS.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: Any) -> None:
        return


def assert_no_horizontal_overflow(page, label: str) -> None:
    metrics = page.evaluate(
        "({scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, "
        "scrollHeight: document.documentElement.scrollHeight, innerHeight: innerHeight})"
    )
    assert metrics["scrollWidth"] <= metrics["innerWidth"], f"{label}: horizontal overflow {metrics}"


def solve_session(page) -> None:
    for _ in range(22):
        state = page.evaluate("window.__fuchsschrift.getState()")
        if state["screen"] != "practice":
            return
        page.evaluate("window.__fuchsschrift.solveCurrent()")
        page.wait_for_timeout(560)
    raise AssertionError("Session did not reach the finish screen")


def draw_current_task_as_pen(page) -> None:
    box = page.locator("#drawing-canvas").bounding_box()
    assert box, "Canvas has no bounding box"
    strokes = page.evaluate("window.__fuchsschrift.board.task.strokes")
    client = page.context.new_cdp_session(page)

    for stroke in strokes:
        first = stroke[0]
        x = box["x"] + first["x"] * box["width"]
        y = box["y"] + first["y"] * box["height"]
        client.send("Input.dispatchMouseEvent", {
            "type": "mouseMoved", "x": x, "y": y, "pointerType": "pen"
        })
        client.send("Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1,
            "clickCount": 1, "pointerType": "pen", "force": 0.55
        })
        for point in stroke[1:]:
            x = box["x"] + point["x"] * box["width"]
            y = box["y"] + point["y"] * box["height"]
            client.send("Input.dispatchMouseEvent", {
                "type": "mouseMoved", "x": x, "y": y, "button": "left", "buttons": 1,
                "pointerType": "pen", "force": 0.55
            })
        client.send("Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": x, "y": y, "button": "left", "buttons": 0,
            "clickCount": 1, "pointerType": "pen"
        })


def main() -> None:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}/?test=1"

    errors: list[str] = []
    chromium_path = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")

    try:
        with sync_playwright() as playwright:
            launch_args: dict[str, Any] = {"headless": True, "args": ["--no-sandbox"]}
            if chromium_path:
                launch_args["executable_path"] = chromium_path
            browser = playwright.chromium.launch(**launch_args)

            # Phone portrait: full start-to-finish flow and failure feedback.
            context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
            page = context.new_page()
            page.on("console", lambda message: errors.append(f"phone console {message.type}: {message.text}") if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"phone pageerror: {error}"))
            page.goto(base_url, wait_until="networkidle")
            assert page.title() == "Fino schreibt"
            assert page.locator(".activity-card").count() == 6
            assert_no_horizontal_overflow(page, "phone home")
            page.screenshot(path=str(ARTIFACTS / "phone-home.png"), full_page=True)

            page.locator('[data-category="letters"]').click()
            page.locator('input[name="letter-selection"][value="custom"] + span').click()
            page.locator("#letter-set").fill("MARTIN")
            page.locator('input[name="difficulty"][value="medium"]').click(force=True)
            page.locator("#start-button").click()
            page.wait_for_selector("#practice-screen:not([hidden])")
            page.wait_for_timeout(850)
            assert_no_horizontal_overflow(page, "phone practice")
            assert page.locator("#drawing-canvas").bounding_box()["height"] > 250
            page.screenshot(path=str(ARTIFACTS / "phone-practice.png"))

            before = page.evaluate("window.__fuchsschrift.getState().index")
            page.evaluate("window.__fuchsschrift.failCurrent()")
            page.wait_for_timeout(120)
            assert page.evaluate("window.__fuchsschrift.getState().index") == before
            assert page.locator("#mentor-message").inner_text() != ""
            solve_session(page)
            page.wait_for_selector("#finish-screen:not([hidden])")
            assert "20 Aufgaben" in page.locator("#finish-summary").inner_text()
            page.screenshot(path=str(ARTIFACTS / "phone-finish.png"))
            context.close()

            # Tablet portrait: name workflow and hard mode.
            context = browser.new_context(viewport={"width": 1024, "height": 1366}, reduced_motion="reduce", has_touch=True, is_mobile=True)
            page = context.new_page()
            page.on("console", lambda message: errors.append(f"tablet console {message.type}: {message.text}") if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"tablet pageerror: {error}"))
            page.goto(base_url, wait_until="networkidle")
            assert_no_horizontal_overflow(page, "tablet home")
            page.locator('[data-category="name"]').click()
            page.locator("#child-name").fill("Käthe")
            page.locator('input[name="difficulty"][value="hard"]').click(force=True)
            page.locator("#start-button").click()
            page.wait_for_selector("#practice-screen:not([hidden])")
            page.wait_for_timeout(550)
            assert page.evaluate("window.__fuchsschrift.getState().screen") == "practice"
            assert_no_horizontal_overflow(page, "tablet practice")
            page.screenshot(path=str(ARTIFACTS / "tablet-practice.png"))
            context.close()

            # Phone landscape: compact two-column practice layout.
            context = browser.new_context(viewport={"width": 844, "height": 390}, reduced_motion="reduce")
            page = context.new_page()
            page.goto(base_url, wait_until="networkidle")
            page.locator("#start-button").click()
            page.wait_for_selector("#practice-screen:not([hidden])")
            page.wait_for_timeout(550)
            assert_no_horizontal_overflow(page, "phone landscape")
            page.screenshot(path=str(ARTIFACTS / "phone-landscape-practice.png"))
            context.close()

            # Trusted pen events and offline service-worker boot.
            context = browser.new_context(viewport={"width": 430, "height": 932}, reduced_motion="reduce")
            page = context.new_page()
            page.on("console", lambda message: errors.append(f"pen console {message.type}: {message.text}") if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"pen pageerror: {error}"))
            page.goto(base_url, wait_until="networkidle")
            page.locator("#start-button").click()
            page.wait_for_selector("#practice-screen:not([hidden])")
            page.wait_for_timeout(900)
            draw_current_task_as_pen(page)
            page.wait_for_timeout(1_200)
            assert page.evaluate("window.__fuchsschrift.getState().completed") == 1

            page.goto(base_url, wait_until="load")
            page.evaluate("navigator.serviceWorker.ready")
            page.reload(wait_until="load")
            page.wait_for_timeout(250)
            assert page.evaluate("Boolean(navigator.serviceWorker.controller)")
            context.set_offline(True)
            page.reload(wait_until="domcontentloaded", timeout=15_000)
            page.wait_for_timeout(250)
            assert page.title() == "Fino schreibt"
            assert page.locator(".activity-card").count() == 6
            context.close()

            browser.close()

        if errors:
            raise AssertionError("Browser console errors:\n" + "\n".join(errors))
        print("Browser smoke tests passed.")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
