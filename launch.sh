#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v npm >/dev/null || { echo "Node.js not installed - get the LTS build from https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "First run - installing dependencies..."; npm install || exit 1; }
npm run dev -- --open
