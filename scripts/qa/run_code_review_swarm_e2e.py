#!/usr/bin/env python3
"""scripts/qa/run_code_review_swarm_e2e.py — Comprehensive Headless Browser Verification for Code Review Swarm (Epic 33)."""

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
            time.sleep(2)

        print("3. Navigating to Agents & Command Center View...")
        agents_btn = page.locator("button:has-text('Agents'), a:has-text('Agents')").first
        if agents_btn.count() > 0:
            agents_btn.click()
            time.sleep(1)

        print("4. Switching to Code Review Swarm & Merge Gate Tab...")
        page.evaluate("""() => {
            const selects = document.querySelectorAll('select');
            for (let s of selects) {
                for (let opt of s.options) {
                    if (opt.value === 'code_reviews') {
                        s.value = 'code_reviews';
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            }
        }""")
        time.sleep(2)

        page_content = page.content()
        assert "Autonomous Code Review Swarm" in page_content, "Missing Code Review Swarm header"
        assert "Total Reviews" in page_content, "Missing Total Reviews KPI card"
        print("  ✓ Code Review Swarm header & KPI cards rendered")

        print("5. Testing + Request Code Review Modal...")
        page.click("button:has-text('+ Request Code Review')")
        time.sleep(1)
        modal_content = page.content()
        assert "Request Code Review" in modal_content, "Modal did not open"
        page.click("button:has-text('Cancel')")
        time.sleep(1)
        print("  ✓ + Request Code Review modal verified")

        print("6. Testing Subtab Navigation...")
        diff_btn = page.locator("button:has-text('Unified Diff')").first
        if diff_btn.count() > 0:
            diff_btn.click()
            time.sleep(0.5)
            print("  ✓ Unified Diff subtab clicked")

        patches_btn = page.locator("button:has-text('Synthesized Patches')").first
        if patches_btn.count() > 0:
            patches_btn.click()
            time.sleep(0.5)
            print("  ✓ Synthesized Patches subtab clicked")

        gate_btn = page.locator("button:has-text('Merge Gate Consensus')").first
        if gate_btn.count() > 0:
            gate_btn.click()
            time.sleep(0.5)
            print("  ✓ Merge Gate Consensus subtab clicked")

        critiques_btn = page.locator("button:has-text('Persona Critiques')").first
        if critiques_btn.count() > 0:
            critiques_btn.click()
            time.sleep(0.5)
            print("  ✓ Persona Critiques subtab clicked")

        print("7. Verification Summary:")
        print(f"  Uncaught console errors: {len(console_errors)}")
        print(f"  Failed 4xx/5xx requests: {len(failed_requests)}")

        browser.close()

        if len(console_errors) > 0 or len(failed_requests) > 0:
            if console_errors:
                print("Console Errors:", console_errors)
            if failed_requests:
                print("Failed Requests:", failed_requests)
            sys.exit(1)
        else:
            print("✅ 100% Code Review Swarm Headless Browser QA Passed Cleanly!")
            sys.exit(0)

if __name__ == "__main__":
    main()
