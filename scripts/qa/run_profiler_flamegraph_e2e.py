#!/usr/bin/env python3
"""scripts/qa/run_profiler_flamegraph_e2e.py — Comprehensive Headless Browser Verification for Autonomous Performance Profiler & Flamegraph Engine (Milestone 18 / Epic 39 / v1.38.0)."""

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
            if response.status >= 400 and "/auth-with-password" not in response.url and "/favicon.ico" not in response.url:
                failed_requests.append(f"{response.request.method} {response.url} -> {response.status}")
        page.on("response", handle_response)

        print(f"1. Navigating to {BASE_URL}...")
        page.goto(BASE_URL, wait_until="networkidle")
        time.sleep(1)

        print("2. Authenticating as superuser...")
        if page.locator("input[type='email'], input[type='text']").count() > 0:
            page.fill("input[type='email'], input[type='text']", SUPERUSER_EMAIL)
            page.fill("input[type='password']", SUPERUSER_PASSWORD)
            page.click("button[type='submit'], button:has-text('Sign In'), button:has-text('Login')")
            page.wait_for_load_state("networkidle")
            time.sleep(1)

        print("3. Navigating to Agents View...")
        page.goto(f"{BASE_URL}/#/agents", wait_until="networkidle")
        time.sleep(1)

        print("4. Switching to Performance Profiler & Flamegraph Tab...")
        perf_tab_btn = page.locator("button:has-text('⚡ Profiler')")
        assert perf_tab_btn.count() > 0, "Could not find '⚡ Profiler' tab button"
        perf_tab_btn.click()
        time.sleep(1)

        print("5. Verifying KPI Cards & Dashboard Render...")
        assert page.locator("text=Profiles Recorded").count() > 0, "Missing 'Profiles Recorded' KPI"
        assert page.locator("text=Avg / P95 Latency").count() > 0, "Missing 'Avg / P95 Latency' KPI"
        assert page.locator("text=Peak Heap & Leaks").count() > 0, "Missing 'Peak Heap & Leaks' KPI"
        assert page.locator("text=Active Bottlenecks").count() > 0, "Missing 'Active Bottlenecks' KPI"
        assert page.locator("text=Fleet Optimization").count() > 0, "Missing 'Fleet Optimization' KPI"

        print("6. Verifying Subtabs Navigation...")
        flame_subtab = page.locator("button:has-text('🔥 Flamegraph')")
        spans_subtab = page.locator("button:has-text('📈 Spans')")
        heap_subtab = page.locator("button:has-text('🧠 Heap')")
        bottlenecks_subtab = page.locator("button:has-text('🚨 Bottlenecks')")

        assert flame_subtab.count() > 0, "Missing Flamegraph subtab"
        assert spans_subtab.count() > 0, "Missing Spans subtab"
        assert heap_subtab.count() > 0, "Missing Heap subtab"
        assert bottlenecks_subtab.count() > 0, "Missing Bottlenecks subtab"

        # Switch to Spans
        spans_subtab.click()
        time.sleep(0.5)

        # Switch to Heap
        heap_subtab.click()
        time.sleep(0.5)

        # Switch to Bottlenecks
        bottlenecks_subtab.click()
        time.sleep(0.5)

        # Switch back to Flamegraph
        flame_subtab.click()
        time.sleep(0.5)

        print("7. Testing '+ Record' Profile Modal Flow...")
        record_btn = page.locator("button:has-text('+ Record')")
        if record_btn.count() > 0:
            record_btn.click()
            time.sleep(0.5)
            assert page.locator("text=Record Performance Profile").count() > 0, "Modal did not open"
            page.fill("input[placeholder*='e.g. Multi-Agent']", "E2E Browser Playwright Profiling Benchmark")
            page.click("button:has-text('Start Profiling')")
            time.sleep(1)

        print("8. Verifying Zero Uncaught Errors...")
        filtered_console_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"Console errors: {len(filtered_console_errors)}")
        print(f"Failed requests: {len(failed_requests)}")

        if filtered_console_errors:
            print("ERROR: Uncaught console errors encountered:")
            for err in filtered_console_errors:
                print(f"  - {err}")
            sys.exit(1)

        if failed_requests:
            print("ERROR: Failed network requests encountered:")
            for req in failed_requests:
                print(f"  - {req}")
            sys.exit(1)

        print("✅ E2E Playwright Browser Verification PASSED with 0 console errors and 0 network failures!")
        browser.close()


if __name__ == "__main__":
    main()
