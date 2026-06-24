#!/bin/sh
# Sync source changes to running container without rebuild
# Usage: sudo sh dev-sync.sh
set -e
echo "[sync] Copying source files to backend container..."
docker compose cp ./backend/src backend:/app/src
docker compose cp ./backend/Cargo.toml backend:/app/
echo "[sync] Done. Container will auto-detect changes."
