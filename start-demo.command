#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  npm install --cache "$(pwd)/.npm-cache"
fi
(sleep 1; open "http://localhost:3939") >/dev/null 2>&1 &
npm start
