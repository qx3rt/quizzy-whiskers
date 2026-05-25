#!/bin/bash
# Safe restart script for backend - ensures graceful shutdown

echo "Stopping backend gracefully..."
pkill -TERM -f "node src/server.js"
sleep 2

echo "Starting backend..."
cd "$(dirname "$0")/backend"
npm start
