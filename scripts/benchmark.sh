#!/bin/bash
# Benchmark comparison script for LazyReview
#
# Usage:
#   ./scripts/benchmark.sh                # Run benchmarks and save baseline
#   ./scripts/benchmark.sh compare        # Compare against baseline
#   ./scripts/benchmark.sh compare old.txt new.txt  # Compare specific files

set -e

BENCH_DIR="./benchmarks"
BASELINE_FILE="benchmark-baseline.txt"
NEW_FILE="benchmark-new.txt"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}LazyReview Benchmark Suite${NC}"
echo "==========================="
echo

# Check if benchstat is installed
if ! command -v benchstat &> /dev/null; then
    echo -e "${YELLOW}Warning: benchstat not installed${NC}"
    echo "Install with: go install golang.org/x/perf/cmd/benchstat@latest"
    echo
fi

run_benchmarks() {
    local output_file=$1
    echo -e "${GREEN}Running benchmarks...${NC}"
    go test -bench=. -benchmem -count=5 "$BENCH_DIR" | tee "$output_file"
    echo
    echo -e "${GREEN}Benchmarks saved to: $output_file${NC}"
}

compare_benchmarks() {
    local old=$1
    local new=$2

    if [ ! -f "$old" ]; then
        echo -e "${RED}Baseline file not found: $old${NC}"
        echo "Run './scripts/benchmark.sh' first to create baseline"
        exit 1
    fi

    if [ ! -f "$new" ]; then
        echo -e "${RED}New benchmark file not found: $new${NC}"
        exit 1
    fi

    echo -e "${GREEN}Comparing benchmarks...${NC}"
    echo

    if command -v benchstat &> /dev/null; then
        benchstat "$old" "$new"
    else
        echo -e "${YELLOW}benchstat not available - showing raw comparison${NC}"
        echo "Old benchmarks: $old"
        echo "New benchmarks: $new"
        echo
        echo "Install benchstat for detailed comparison:"
        echo "  go install golang.org/x/perf/cmd/benchstat@latest"
    fi
}

# Parse command
case "${1:-run}" in
    compare)
        if [ -n "$2" ] && [ -n "$3" ]; then
            compare_benchmarks "$2" "$3"
        else
            run_benchmarks "$NEW_FILE"
            compare_benchmarks "$BASELINE_FILE" "$NEW_FILE"
        fi
        ;;
    run|baseline)
        run_benchmarks "$BASELINE_FILE"
        echo
        echo -e "${GREEN}Baseline established!${NC}"
        echo "Run './scripts/benchmark.sh compare' after making changes"
        ;;
    *)
        echo "Usage: $0 {run|compare|compare <old.txt> <new.txt>}"
        exit 1
        ;;
esac
