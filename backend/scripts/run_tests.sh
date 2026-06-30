#!/usr/bin/env bash
# VirtAI Test Orchestrator
# Canonical test runner running all architectural layers.

# Exit on shell errors, but let pytest failures compile.
set -eo pipefail

# Navigate to backend directory
cd "$(dirname "$0")/.." || exit 1

LAYERS=(
    "tests/domain"
    "tests/shared"
    "tests/unit"
    "tests/infrastructure"
    "tests/application"
    "tests/presentation"
    "tests/integration"
)

REPORT_DIR="test_reports"
ERRORS_DIR="$REPORT_DIR/errors"

# Clean old artifacts
mkdir -p "$REPORT_DIR" "$ERRORS_DIR"
rm -f "$REPORT_DIR"/*.xml "$REPORT_DIR"/*.log
rm -f "$ERRORS_DIR"/*.md
rm -f "$REPORT_DIR/errors.md"

# Clear previous coverage data
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

$PYTHON_CMD -m coverage erase 2>/dev/null || true

echo "========================================================"
echo " Starting VirtAI Architectural Test Pipeline"
echo "========================================================"
echo ""

# Track failures
FAILED_LAYERS=()

# Run layers
for layer in "${LAYERS[@]}"; do
    if [ ! -d "$layer" ]; then
        echo "Directory $layer not found, skipping..."
        continue
    fi

    # Replace / and \ with _ for filename
    safe_name=$(echo "$layer" | tr '/' '_' | tr '\\' '_')
    echo "Running $layer..."

    # Run pytest, redirecting output to log file
    # We do NOT exit on pytest failure; we want to run all layers
    exit_code=0
    $PYTHON_CMD -m pytest "$layer" -q --tb=short --cov=app --cov-append --junitxml="$REPORT_DIR/${safe_name}.xml" > "$REPORT_DIR/${safe_name}.log" 2>&1 || exit_code=$?

    if [ $exit_code -ne 0 ]; then
        # Exclude load_tests from failing the pipeline exit code (but still record it)
        if [ "$layer" != "load_tests" ]; then
            FAILED_LAYERS+=("$layer")
        fi
    fi
done

# Compile reports via generate_reports.py
echo ""
echo "Generating test failure reports..."
$PYTHON_CMD ./scripts/generate_reports.py --tests-only

# Print exit verdict
if [ ${#FAILED_LAYERS[@]} -ne 0 ]; then
    echo ""
    echo "[!] CRITICAL FAILURES SUMMARY:"
    for fl in "${FAILED_LAYERS[@]}"; do
        echo "    - $fl"
    done
    exit 1
else
    echo ""
    echo "[+] All non-load architectural layers passed successfully."
    exit 0
fi
