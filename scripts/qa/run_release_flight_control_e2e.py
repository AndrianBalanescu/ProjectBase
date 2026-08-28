#!/usr/bin/env python3
"""scripts/qa/run_release_flight_control_e2e.py — Comprehensive Headless Browser Verification for Release Flight Control & Canary Sentinel (Epic 34)."""

import sys
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8120"
SUPERUSER_EMAIL = "f@flow.com"
SUPERUSER_PASSWORD = "superdev123"

def main():
    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Listen for console errors
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # Listen for 4xx/5xx network failures
        def handle_response(response):
            if response.status >= 400 and not "/auth-with-password" in response.url and not "/favicon.ico" in response.url:
                failed_requests.append(f"{response.request.method} {response.url} -> {response.status}")
        page.on("response", handle_response)

        print(f"1. Navigating to {BASE_URL}...")
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)

        print("2. Authenticating as superuser...")
        if page.locator("input[type='email'], input[type='text']").count() > 0:
            page.fill("input[type='email'], input[type='text']", SUPERUSER_EMAIL)
            page.fill("input[type='password']", SUPERUSER_PASSWORD)
            page.click("button[type='submit'], button:has-text('Sign In'), button:has-text('Log In')")
            time.sleep(1.5)

        print("3. Navigating to Agents Command Center...")
        agents_btn = page.locator("button:has-text('Agents'), a[href*='agents'], button:has-text('🤖')").first
        if agents_btn.count() > 0:
            agents_btn.click()
            time.sleep(1)

        print("4. Switching to 'Release Flight Control & Canary Rollback' tab...")
        gov_select = page.locator("select:has(option[value='releases'])")
        if gov_select.count() > 0:
            gov_select.select_option("releases")
            time.sleep(1)

        print("5. Verifying Release Flight Control KPI ribbon and UI surfaces...")
        assert page.locator("text=Active Deployments").count() > 0, "Missing Active Deployments card"
        assert page.locator("text=Canary Traffic Split").count() > 0, "Missing Canary Traffic Split card"
        assert page.locator("text=Rollback MTTR").count() > 0, "Missing Rollback MTTR card"
        assert page.locator("text=Health Gate SLA").count() > 0, "Missing Health Gate SLA card"
        assert page.locator("text=Fleet Stability").count() > 0, "Missing Fleet Stability card"

        print("6. Seeding demo releases and inspecting active canary...")
        seed_btn = page.locator("button:has-text('Seed Demo')")
        if seed_btn.count() > 0:
            seed_btn.click()
            time.sleep(1)

        # Select first release in roster
        first_release_item = page.locator("div[class*='border transition-all cursor-pointer']").first
        if first_release_item.count() > 0:
            first_release_item.click()
            time.sleep(0.5)

        print("7. Testing subtabs navigation...")
        # 1. Probes
        probes_tab = page.locator("button:has-text('Health Probes')")
        if probes_tab.count() > 0:
            probes_tab.click()
            time.sleep(0.5)
            # Ingest simulated telemetry
            sim_btn = page.locator("button:has-text('Send Sample Stream')")
            if sim_btn.count() > 0:
                sim_btn.click()
                time.sleep(0.5)

        # 2. Sentinel
        sentinel_tab = page.locator("button:has-text('Rollback Sentinel')")
        if sentinel_tab.count() > 0:
            sentinel_tab.click()
            time.sleep(0.5)

        # 3. Ground-truth manifest
        manifest_tab = page.locator("button:has-text('Ground-Truth Manifest')")
        if manifest_tab.count() > 0:
            manifest_tab.click()
            time.sleep(0.5)

        # 4. Stages pipeline
        stages_tab = page.locator("button:has-text('Canary Stage Pipeline')")
        if stages_tab.count() > 0:
            stages_tab.click()
            time.sleep(0.5)

        print("8. Verifying zero console errors and zero network failures...")
        filtered_errors = [e for e in console_errors if "favicon" not in e]
        if filtered_errors:
            print(f"FAILED: Console errors detected: {filtered_errors}", file=sys.stderr)
            browser.close()
            sys.exit(1)

        if failed_requests:
            print(f"FAILED: Network failures detected: {failed_requests}", file=sys.stderr)
            browser.close()
            sys.exit(1)

        print("✅ E2E Headless Playwright Verification for Release Flight Control PASSED cleanly with 0 errors!")
        browser.close()

if __name__ == "__main__":
    main()
