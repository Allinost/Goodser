#!/bin/sh
# Goodser dev entrypoint: compile, run, watch source for changes
trap 'echo "[dev] Entry exited ($?)"' EXIT

echo "[dev] Starting goodser-backend in development mode..."

# First compilation - show output
echo "[dev] Initial compilation..."
cargo build 2>&1
if [ $? -ne 0 ]; then
    echo "[dev] Initial compilation failed, waiting for source changes..."
fi

while true; do
    echo "[dev] Starting server..."
    cargo run 2>&1 &
    CARGO_PID=$!

    # Wait for cargo run to exit (binary stops or compilation fails)
    wait $CARGO_PID 2>/dev/null
    echo "[dev] Server stopped (exit code: $?)"

    # Wait for source changes before next rebuild
    if [ -d /app/src ]; then
        inotifywait -r -q \
            -e modify,create,delete,move \
            --exclude '(^|/)(target/|\.git/)' \
            /app/src/ 2>/dev/null
        echo "[dev] Source changed, recompiling..."
    else
        echo "[dev] Waiting for /app/src..."
        sleep 2
    fi
done
