#!/usr/bin/env python3
"""
VirtAI Report Generator
Single source of truth for parsing quality metrics and test reports and compiling them into clean, structured Markdown and JSON dashboards.
"""

import os
import sys
import re
import json
import shutil
import xml.etree.ElementTree as ET
import argparse
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPORT_DIR = BACKEND_DIR / "test_reports"
ERRORS_DIR = REPORT_DIR / "errors"
QUALITY_REPORTS_DIR = BACKEND_DIR / "quality_reports"

LAYERS = [
    "tests/domain",
    "tests/shared",
    "tests/unit",
    "tests/infrastructure",
    "tests/application",
    "tests/presentation",
    "tests/integration",
    "load_tests",
]

def safe_text(value):
    if value is None:
        return ""
    return str(value).strip()

def md_codeblock(text, lang="text"):
    text = "" if text is None else str(text)
    text = text.replace("```", "``\\`")
    return f"~~~{lang}\n{text}\n~~~"

def parse_testsuite(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    testsuite = root.find(".//testsuite")
    if testsuite is None:
        testsuite = root
    tests = int(testsuite.get("tests", 0))
    failures = int(testsuite.get("failures", 0))
    errors = int(testsuite.get("errors", 0))
    skipped = int(testsuite.get("skipped", 0))
    return testsuite, tests, failures, errors, skipped

def extract_case_issue(testcase):
    failure_node = testcase.find("failure")
    error_node = testcase.find("error")
    if failure_node is not None:
        kind = "Failure"
        node = failure_node
    elif error_node is not None:
        kind = "Error"
        node = error_node
    else:
        return None

    classname = testcase.get("classname", "").strip()
    name = testcase.get("name", "").strip()
    message = safe_text(node.get("message", ""))
    details = safe_text(node.text)
    return {
        "kind": kind,
        "classname": classname,
        "name": name,
        "message": message,
        "details": details,
    }

def compile_test_reports():
    """Parse test layer XML files and write test_reports/errors.md and error sub-files."""
    ERRORS_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    critical_failures = []
    total_passed = 0
    total_failed = 0
    total_skipped = 0

    layer_data = []

    for layer in LAYERS:
        safe_name = layer.replace("/", "_").replace("\\", "_")
        xml_file = REPORT_DIR / f"{safe_name}.xml"
        log_file = REPORT_DIR / f"{safe_name}.log"

        if not xml_file.exists():
            layer_data.append({
                "layer": layer,
                "safe_name": safe_name,
                "exists": False,
                "tests": 0,
                "failures": 0,
                "errors": 0,
                "skipped": 0,
                "passed": 0,
                "status": "SKIPPED",
                "issues": [],
                "xml_file": str(xml_file.relative_to(BACKEND_DIR)),
                "log_file": str(log_file.relative_to(BACKEND_DIR)),
            })
            results.append((layer, 0, 0, 0, "SKIPPED"))
            continue

        try:
            testsuite, tests, failures, errors, skipped = parse_testsuite(xml_file)
            failed = failures + errors
            passed = max(tests - failed - skipped, 0)
            status = "FAIL" if failed > 0 else ("PASS" if tests > 0 else "EMPTY")

            issues = []
            for testcase in testsuite.findall(".//testcase"):
                issue = extract_case_issue(testcase)
                if issue is not None:
                    issues.append(issue)
                    critical_failures.append(f"{issue['classname']}::{issue['name']}")

            layer_data.append({
                "layer": layer,
                "safe_name": safe_name,
                "exists": True,
                "tests": tests,
                "failures": failures,
                "errors": errors,
                "skipped": skipped,
                "passed": passed,
                "status": status,
                "issues": issues,
                "xml_file": str(xml_file.relative_to(BACKEND_DIR)),
                "log_file": str(log_file.relative_to(BACKEND_DIR)),
            })
            results.append((layer, passed, failed, skipped, status))
            total_passed += passed
            total_failed += failed
            total_skipped += skipped
        except Exception as e:
            layer_data.append({
                "layer": layer,
                "safe_name": safe_name,
                "exists": True,
                "tests": 0,
                "failures": 0,
                "errors": 0,
                "skipped": 0,
                "passed": 0,
                "status": "ERROR",
                "issues": [{
                    "kind": "ParserError",
                    "classname": "",
                    "name": "",
                    "message": str(e),
                    "details": "",
                }],
                "xml_file": str(xml_file.relative_to(BACKEND_DIR)),
                "log_file": str(log_file.relative_to(BACKEND_DIR)),
            })
            results.append((layer, 0, 0, 0, "ERROR"))
            critical_failures.append(f"{layer}::XML_PARSE_ERROR")

    total_tests = total_passed + total_failed
    success_pct = (total_passed / total_tests * 100) if total_tests > 0 else 0.0

    # Write errors.md
    master_md = [
        "# VirtAI Test Failures Report",
        "",
        "- Generated automatically from the test pipeline.",
        f"- Total Passed: **{total_passed}**",
        f"- Total Failed: **{total_failed}**",
        f"- Total Skipped: **{total_skipped}**",
        f"- Success Percentage: **{success_pct:.2f}%**",
        "",
        "## Summary",
        "",
        "| Layer | Passed | Failed | Skipped | Status | Log |",
        "|---|---:|---:|---:|---|---|",
    ]

    for item in layer_data:
        log_ref = f"`{item['log_file']}`"
        master_md.append(
            f"| {item['layer']} | {item['passed']} | {item['failures'] + item['errors']} | {item['skipped']} | {item['status']} | {log_ref} |"
        )

    master_md.append("")
    master_md.append("## Failed Layers")
    master_md.append("")

    any_failures = False
    for item in layer_data:
        layer = item["layer"]
        issues = item["issues"]
        if item["status"] in ("PASS", "EMPTY") and not issues:
            continue

        if item["status"] == "SKIPPED" and not item["exists"]:
            master_md.append(f"### {layer}")
            master_md.append("")
            master_md.append("Directory not found. Layer skipped.")
            master_md.append("")
            continue

        if not issues:
            continue

        any_failures = True
        layer_file = ERRORS_DIR / f"{item['safe_name']}.md"

        layer_md = [
            f"# Failures for {layer}",
            "",
            f"- Status: **{item['status']}**",
            f"- Tests: **{item['tests']}**",
            f"- Passed: **{item['passed']}**",
            f"- Failed: **{item['failures'] + item['errors']}**",
            f"- Skipped: **{item['skipped']}**",
            f"- Log: `{item['log_file']}`",
            "",
            "## Issues",
            "",
        ]

        master_md.append(f"### {layer}")
        master_md.append("")
        master_md.append(f"- Status: **{item['status']}**")
        master_md.append(f"- Tests: **{item['tests']}**")
        master_md.append(f"- Failed: **{item['failures'] + item['errors']}**")
        master_md.append(f"- Report: `{layer_file.relative_to(BACKEND_DIR)}`")
        master_md.append("")

        for idx, issue in enumerate(issues, start=1):
            test_id = f"{issue['classname']}::{issue['name']}" if (issue["classname"] or issue["name"]) else "Unknown test"
            layer_md.append(f"### {idx}. {test_id}")
            layer_md.append("")
            layer_md.append(f"- Type: **{issue['kind']}**")
            if issue["message"]:
                layer_md.append(f"- Message: {issue['message']}")
            layer_md.append("")
            if issue["details"]:
                layer_md.append("#### Details")
                layer_md.append("")
                layer_md.append(md_codeblock(issue["details"], "text"))
                layer_md.append("")
            else:
                layer_md.append("_No traceback/details captured in XML._")
                layer_md.append("")

            master_md.append(f"#### {idx}. {test_id}")
            master_md.append("")
            master_md.append(f"- Type: **{issue['kind']}**")
            if issue["message"]:
                master_md.append(f"- Message: {issue['message']}")
            master_md.append("")

        layer_md_content = "\n".join(layer_md).rstrip() + "\n"
        layer_file.write_text(layer_md_content, encoding="utf-8")

    master_md.append("")
    if not any_failures:
        master_md.append("No test failures were captured.")
        master_md.append("")

    (REPORT_DIR / "errors.md").write_text("\n".join(master_md).rstrip() + "\n", encoding="utf-8")

    # Print dashboard to console
    print("\n")
    print("+" + "-"*76 + "+")
    print("|" + " VIRTAI TEST PIPELINE DASHBOARD ".center(76) + "|")
    print("+" + "-"*76 + "+")
    print(f"| {'Test Layer':<22} | {'Passed':<8} | {'Failed':<8} | {'Skipped':<8} | {'Status':<15} |")
    print("+" + "-"*24 + "+" + "-"*10 + "+" + "-"*10 + "+" + "-"*10 + "+" + "-"*17 + "+")

    for r in results:
        layer, passed, failed, skipped, status = r
        print(f"| {layer:<22} | {passed:<8} | {failed:<8} | {skipped:<8} | {status:<15} |")

    print("+" + "-"*76 + "+")
    print(f"| TOTAL SUCCESS PERCENTAGE: {success_pct:.2f}%".ljust(77) + "|")
    print("+" + "-"*76 + "+")

def get_log_content(log_file: Path) -> str:
    if log_file.exists():
        return log_file.read_text(encoding="utf-8")
    return ""

def compile_quality_reports():
    """Compile Ruff, MyPy, Bandit logs along with coverage and Pytest summaries."""
    QUALITY_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Parse Ruff Log
    ruff_log = get_log_content(QUALITY_REPORTS_DIR / "ruff.log")
    lint_pass = True
    lint_count = 0
    if ruff_log:
        for line in ruff_log.split("\n"):
            if "Found" in line and "error" in line:
                match = re.search(r'Found (\d+) error', line)
                if match:
                    lint_count = int(match.group(1))
                    break
        if lint_count == 0:
            lint_count = len([l for l in ruff_log.split("\n") if re.match(r'^.*\.\w+:\d+:\d+:', l)])
        lint_pass = (lint_count == 0)

    with open(QUALITY_REPORTS_DIR / "lint_report.md", "w", encoding="utf-8") as f:
        f.write("# Linting Report (Ruff)\n\n")
        f.write(f"- **Linting Pass:** {lint_pass}\n")
        f.write(f"- **Issues Found:** {lint_count}\n\n")
        f.write("## Raw Ruff Output\n")
        f.write("```\n")
        f.write(ruff_log if ruff_log else "No log output available.")
        f.write("\n```\n")

    # 2. Parse MyPy Log
    mypy_log = get_log_content(QUALITY_REPORTS_DIR / "mypy.log")
    typing_pass = True
    mypy_count = 0
    if mypy_log:
        for line in mypy_log.split("\n"):
            if "Found" in line and "error" in line:
                match = re.search(r'Found (\d+) error', line)
                if match:
                    mypy_count = int(match.group(1))
                    break
        if mypy_count == 0:
            mypy_count = len([l for l in mypy_log.split("\n") if "error:" in l])
        typing_pass = (mypy_count == 0)

    with open(QUALITY_REPORTS_DIR / "typing_report.md", "w", encoding="utf-8") as f:
        f.write("# Static Type Checking Report (MyPy)\n\n")
        f.write(f"- **Typing Pass:** {typing_pass}\n")
        f.write(f"- **Issues Found:** {mypy_count}\n\n")
        f.write("## Raw MyPy Output\n")
        f.write("```\n")
        f.write(mypy_log if mypy_log else "No log output available.")
        f.write("\n```\n")

    # 3. Parse Bandit Log
    bandit_json_path = QUALITY_REPORTS_DIR / "bandit_temp.json"
    bandit_issues = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    security_pass = True
    total_sec_issues = 0

    if bandit_json_path.exists():
        try:
            with open(bandit_json_path, "r", encoding="utf-8") as f:
                sec_data = json.load(f)
                for issue in sec_data.get("results", []):
                    sev = issue.get("issue_severity", "LOW").upper()
                    if sev in bandit_issues:
                        bandit_issues[sev] += 1
                        total_sec_issues += 1
            bandit_json_path.unlink()
        except Exception:
            pass

    bandit_log = get_log_content(QUALITY_REPORTS_DIR / "bandit.log")
    if total_sec_issues == 0 and bandit_log:
        for line in bandit_log.split("\n"):
            if "Severity:" in line:
                for sev in bandit_issues.keys():
                    if sev in line.upper():
                        bandit_issues[sev] += 1
                        total_sec_issues += 1
    security_pass = (bandit_issues["CRITICAL"] == 0 and bandit_issues["HIGH"] == 0)

    with open(QUALITY_REPORTS_DIR / "security_report.md", "w", encoding="utf-8") as f:
        f.write("# Security Scanning Report (Bandit)\n\n")
        f.write(f"- **Security Pass:** {security_pass}\n")
        f.write(f"- **Critical Issues:** {bandit_issues['CRITICAL']}\n")
        f.write(f"- **High Issues:** {bandit_issues['HIGH']}\n")
        f.write(f"- **Medium Issues:** {bandit_issues['MEDIUM']}\n")
        f.write(f"- **Low Issues:** {bandit_issues['LOW']}\n\n")
        f.write("## Raw Security Scan Log\n")
        f.write("```\n")
        f.write(bandit_log if bandit_log else "No log output available.")
        f.write("\n```\n")

    # 4. Parse Coverage Log
    coverage_log = get_log_content(QUALITY_REPORTS_DIR / "coverage.log")
    cov_pct = "0.00%"
    if coverage_log:
        for line in coverage_log.split("\n"):
            if line.startswith("TOTAL"):
                parts = line.split()
                if len(parts) >= 4:
                    cov_pct = parts[-1]
                    break

    # 5. Parse Test failure counts from test_reports/errors.md
    test_fails = 0
    test_passed = 0
    test_skipped = 0
    tests_pass = True
    errors_md_path = REPORT_DIR / "errors.md"

    if errors_md_path.exists():
        shutil.copy(errors_md_path, QUALITY_REPORTS_DIR / "test_failures.md")
        content = errors_md_path.read_text(encoding="utf-8")
        for line in content.split("\n"):
            m_fail = re.search(r'Total Failed: \*\*(\d+)\*\*', line)
            m_pass = re.search(r'Total Passed: \*\*(\d+)\*\*', line)
            m_skip = re.search(r'Total Skipped: \*\*(\d+)\*\*', line)
            if m_fail:
                test_fails = int(m_fail.group(1))
            if m_pass:
                test_passed = int(m_pass.group(1))
            if m_skip:
                test_skipped = int(m_skip.group(1))

        in_summary = False
        for line in content.split("\n"):
            if "| Layer |" in line:
                in_summary = True
                continue
            if in_summary and line.strip().startswith("|"):
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 6:
                    layer_name = parts[1]
                    layer_status = parts[5]
                    if layer_name != "load_tests" and layer_status in ("FAIL", "ERROR"):
                        tests_pass = False
            elif in_summary and not line.strip():
                in_summary = False
    else:
        tests_pass = False

    # Write summary.json
    summary_data = {
        "linting": {"pass": lint_pass, "issues": lint_count},
        "typing": {"pass": typing_pass, "issues": mypy_count},
        "security": {"pass": security_pass, "issues": bandit_issues},
        "tests": {"pass": tests_pass, "passed": test_passed, "failures": test_fails, "skipped": test_skipped},
        "coverage": {"percentage": cov_pct}
    }
    with open(QUALITY_REPORTS_DIR / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    # Compile verdict
    verdict = "PRODUCTION READY" if (lint_pass and typing_pass and security_pass and tests_pass) else "NOT READY"

    # Write dashboard.md
    dashboard = [
        "======================================================",
        "VirtAI Quality Dashboard",
        "========================",
        "",
        f"Linting        {'PASS' if lint_pass else 'FAIL'} (Issues: {lint_count})",
        f"Typing         {'PASS' if typing_pass else 'FAIL'} (Issues: {mypy_count})",
        f"Security       {'PASS' if security_pass else 'FAIL'} (Critical/High: {bandit_issues['CRITICAL'] + bandit_issues['HIGH']})",
        f"Tests          {'PASS' if tests_pass else 'FAIL'} (Passed: {test_passed}, Failed: {test_fails})",
        f"Coverage       {cov_pct}",
        "",
        "---",
        "",
        f"Total Issues: {lint_count + mypy_count + total_sec_issues + test_fails}",
        f"Critical/High Issues: {bandit_issues['CRITICAL'] + bandit_issues['HIGH'] + test_fails}",
        f"Medium Issues: {mypy_count + bandit_issues['MEDIUM']}",
        f"Low Issues: {lint_count + bandit_issues['LOW']}",
        "",
        "---",
        "",
        "FINAL VERDICT:",
        "",
        verdict,
        "",
        "======================================================"
    ]
    dashboard_str = "\n".join(dashboard)
    with open(QUALITY_REPORTS_DIR / "dashboard.md", "w", encoding="utf-8") as f:
        f.write(dashboard_str + "\n")

    # Write quality_report.md
    quality_report = [
        "# VirtAI Quality Assurance Report",
        "",
        "This report aggregates the results of linting, static type checking, security scanning, architectural test layers, and code coverage.",
        "",
        "## Executive Summary",
        "",
        f"| Metric | Status | Issues | Details |",
        f"|---|---|---|---|",
        f"| **Linting (Ruff)** | {'🟢 PASS' if lint_pass else '🔴 FAIL'} | {lint_count} | See [lint_report.md](lint_report.md) |",
        f"| **Typing (MyPy)** | {'🟢 PASS' if typing_pass else '🔴 FAIL'} | {mypy_count} | See [typing_report.md](typing_report.md) |",
        f"| **Security (Bandit)** | {'🟢 PASS' if security_pass else '🔴 FAIL'} | {total_sec_issues} | See [security_report.md](security_report.md) |",
        f"| **Tests (Pytest)** | {'🟢 PASS' if tests_pass else '🔴 FAIL'} | {test_fails} failed | See [test_failures.md](test_failures.md) |",
        f"| **Code Coverage** | - | {cov_pct} | See [coverage.log](coverage.log) |",
        "",
        "### Final Verdict",
        "",
        f"**SYSTEM IS {verdict}**",
        "",
        "---",
        "*Report generated automatically by `scripts/generate_reports.py`.*"
    ]
    with open(QUALITY_REPORTS_DIR / "quality_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(quality_report) + "\n")

    print("\n" + dashboard_str)

def main():
    parser = argparse.ArgumentParser(description="VirtAI Report Compiler")
    parser.add_argument("--tests-only", action="store_true", help="Compile only Pytest JUnit reports")
    args = parser.parse_args()

    if args.tests_only:
        compile_test_reports()
    else:
        compile_test_reports()
        compile_quality_reports()

if __name__ == "__main__":
    main()
