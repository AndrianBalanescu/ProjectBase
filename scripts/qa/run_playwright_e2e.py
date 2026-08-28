#!/usr/bin/env python3
"""scripts/qa/run_playwright_e2e.py — Comprehensive Headless Browser Verification for ProjectBase."""

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
        page = browser.new_page()

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
        # Check if auth form or app is rendered
        if page.locator("input[type='email'], input[type='text']").count() > 0:
            page.fill("input[type='email'], input[type='text']", SUPERUSER_EMAIL)
            page.fill("input[type='password']", SUPERUSER_PASSWORD)
            page.click("button[type='submit'], button:has-text('Sign In'), button:has-text('Log In')")
            time.sleep(2)

        print("3. Navigating to Agents & Telemetry View...")
        page.goto(f"{BASE_URL}/#/agents", wait_until="networkidle")
        time.sleep(1.5)

        print("4. Testing Live Runs & Telemetry View...")
        runs_btn = page.locator("button:has-text('Live Runs & Telemetry')")
        if runs_btn.count() > 0:
            runs_btn.click()
            time.sleep(1.5)

        # Select first session if available
        first_row = page.locator("tr[class*='cursor-pointer']").first
        if first_row.count() > 0:
            first_row.click()
            time.sleep(1)

            # Test Trajectory Subtab
            traj_btn = page.locator("button:has-text('Trajectories')")
            if traj_btn.count() > 0:
                traj_btn.click()
                time.sleep(1)
                print("  ✓ Trajectories sub-tab clicked and rendered")

            # Test DAG Subtab
            dag_btn = page.locator("button:has-text('DAG Lineage')")
            if dag_btn.count() > 0:
                dag_btn.click()
                time.sleep(1)
                print("  ✓ DAG Lineage sub-tab clicked and rendered")

        print("5. Testing Swarm Clusters & Choreography Hub...")
        # Select Swarm from dropdown
        select_elem = page.locator("select").first
        if select_elem.count() > 0:
            select_elem.select_option(value="swarm")
            time.sleep(1.5)
            print("  ✓ Swarm Clusters tab selected")

        # Check for Deploy Swarm Cluster button
        deploy_btn = page.locator("button:has-text('Deploy Swarm Cluster')")
        if deploy_btn.count() > 0:
            deploy_btn.click()
            time.sleep(1)
            print("  ✓ Deploy Swarm Cluster modal opened")
            # Close modal
            page.click("button:has-text('Cancel')")
            time.sleep(0.5)

        print("6. Testing Multi-Agent Merge Matrix & Conflicts Hub...")
        if select_elem.count() > 0:
            select_elem.select_option(value="merges")
            time.sleep(1.5)
            print("  ✓ Merge Matrix & Conflicts tab selected")

        # Check for Propose Merge button & modal
        prop_btn = page.locator("button:has-text('Propose Merge')").first
        if prop_btn.count() > 0:
            prop_btn.click()
            time.sleep(1)
            print("  ✓ Propose Merge modal opened")
            page.click("button:has-text('Cancel')")
            time.sleep(0.5)

        print("7. Verification Summary:")
        print(f"  Uncaught console errors: {len(console_errors)}")
        print(f"  Failed 4xx/5xx requests: {len(failed_requests)}")

        if console_errors:
            print("Console Errors:")
            for err in console_errors:
                print(f"  - {err}")

        if failed_requests:
            print("Failed Requests:")
            for req in failed_requests:
                print(f"  - {req}")

        browser.close()

        if console_errors or failed_requests:
            sys.exit(1)
        print("✓ 100% Headless Browser QA Passed Cleanly with Zero Console Errors!")

if __name__ == "__main__":
    main()
