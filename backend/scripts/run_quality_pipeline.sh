#!/usr/bin/env bash
# VirtAI Quality Validation Pipeline
# Orchestrates linting, typing, security, testing, coverage, and reporting.

# Navigate to backend directory
cd "$(dirname "$0")/.." || exit 1

QUALITY_REPORTS_DIR="quality_reports"
mkdir -p "$QUALITY_REPORTS_DIR"

# Clean old logs inside reports dir
rm -f "$QUALITY_REPORTS_DIR"/*.log
rm -f "$QUALITY_REPORTS_DIR"/*.json
rm -f "$QUALITY_REPORTS_DIR"/*.md
rm -rf "$QUALITY_REPORTS_DIR/coverage_html"

if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

echo "======================================================"
echo " Starting VirtAI Production QA Pipeline"
echo "======================================================"

# 1. Linting
echo ""
echo "[+] Running Ruff (Linting)..."
$PYTHON_CMD -m ruff check app tests > "$QUALITY_REPORTS_DIR/ruff.log" 2>&1 || true

# 2. Static Typing
echo "[+] Running MyPy (Typing)..."
$PYTHON_CMD -m mypy --follow-imports=silent app/domain app/application > "$QUALITY_REPORTS_DIR/mypy.log" 2>&1 || true

# 3. Security
echo "[+] Running Bandit (Security)..."
$PYTHON_CMD -m bandit -r app -f json -o "$QUALITY_REPORTS_DIR/bandit_temp.json" > /dev/null 2>&1 || true
$PYTHON_CMD -m bandit -r app > "$QUALITY_REPORTS_DIR/bandit.log" 2>&1 || true

# 4. Testing
echo "[+] Running Architectural & Integration Tests..."
./scripts/run_tests.sh > /dev/null 2>&1 || true

# 5. Coverage Report Generation
echo "[+] Generating Coverage Reports..."
$PYTHON_CMD -m coverage xml -o "$QUALITY_REPORTS_DIR/coverage.xml" > /dev/null 2>&1 || true
$PYTHON_CMD -m coverage html -d "$QUALITY_REPORTS_DIR/coverage_html" > /dev/null 2>&1 || true
$PYTHON_CMD -m coverage report > "$QUALITY_REPORTS_DIR/coverage.log" 2>&1 || true

# 6. Report Compilation
echo "[+] Compiling pipeline reports..."
$PYTHON_CMD ./scripts/generate_reports.py

# Determine exit code based on summary.json
echo ""
$PYTHON_CMD -c "
import json
import sys
try:
    with open('quality_reports/summary.json', 'r') as f:
        data = json.load(f)
    lint_ok = data['linting']['pass']
    type_ok = data['typing']['pass']
    sec_ok = data['security']['pass']
    tests_ok = data['tests']['pass']
    if lint_ok and type_ok and sec_ok and tests_ok:
        print('[+] Pipeline passed: SYSTEM IS PRODUCTION READY.')
        sys.exit(0)
    else:
        print('[!] Pipeline failed: System is NOT ready.')
        sys.exit(1)
except Exception as e:
    print(f'[!] Failed to verify pipeline verdict: {e}')
    sys.exit(1)
"
