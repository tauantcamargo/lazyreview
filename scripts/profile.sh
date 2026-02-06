#!/bin/bash
# Performance profiling script for LazyReview
#
# Usage:
#   ./scripts/profile.sh cpu    # CPU profiling
#   ./scripts/profile.sh mem    # Memory profiling
#   ./scripts/profile.sh block  # Block profiling
#   ./scripts/profile.sh all    # All profiling types

set -e

PROFILE_DIR="./profiles"
BENCH_DIR="./benchmarks"

# Create profiles directory
mkdir -p "$PROFILE_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}LazyReview Performance Profiling${NC}"
echo "=================================="
echo

profile_cpu() {
    echo -e "${GREEN}Running CPU profiling...${NC}"
    go test -bench=. -benchmem -cpuprofile="$PROFILE_DIR/cpu.prof" "$BENCH_DIR"

    echo -e "${YELLOW}CPU profile saved to: $PROFILE_DIR/cpu.prof${NC}"
    echo -e "View with: ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/cpu.prof${NC}"
    echo
}

profile_memory() {
    echo -e "${GREEN}Running memory profiling...${NC}"
    go test -bench=. -benchmem -memprofile="$PROFILE_DIR/mem.prof" "$BENCH_DIR"

    echo -e "${YELLOW}Memory profile saved to: $PROFILE_DIR/mem.prof${NC}"
    echo -e "View with: ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/mem.prof${NC}"
    echo
}

profile_block() {
    echo -e "${GREEN}Running block profiling...${NC}"
    go test -bench=. -benchmem -blockprofile="$PROFILE_DIR/block.prof" "$BENCH_DIR"

    echo -e "${YELLOW}Block profile saved to: $PROFILE_DIR/block.prof${NC}"
    echo -e "View with: ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/block.prof${NC}"
    echo
}

profile_trace() {
    echo -e "${GREEN}Running trace profiling...${NC}"
    go test -bench=BenchmarkFullStartup -trace="$PROFILE_DIR/trace.out" "$BENCH_DIR"

    echo -e "${YELLOW}Trace saved to: $PROFILE_DIR/trace.out${NC}"
    echo -e "View with: ${BLUE}go tool trace $PROFILE_DIR/trace.out${NC}"
    echo
}

# Parse arguments
case "${1:-all}" in
    cpu)
        profile_cpu
        ;;
    mem|memory)
        profile_memory
        ;;
    block)
        profile_block
        ;;
    trace)
        profile_trace
        ;;
    all)
        profile_cpu
        profile_memory
        profile_block
        ;;
    *)
        echo "Usage: $0 {cpu|mem|block|trace|all}"
        exit 1
        ;;
esac

echo -e "${GREEN}Profiling complete!${NC}"
echo
echo "Quick commands:"
echo -e "  CPU:     ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/cpu.prof${NC}"
echo -e "  Memory:  ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/mem.prof${NC}"
echo -e "  Block:   ${BLUE}go tool pprof -http=:8080 $PROFILE_DIR/block.prof${NC}"
if [ -f "$PROFILE_DIR/trace.out" ]; then
    echo -e "  Trace:   ${BLUE}go tool trace $PROFILE_DIR/trace.out${NC}"
fi
