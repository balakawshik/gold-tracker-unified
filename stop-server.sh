#!/bin/bash

# Stop the APK download server

if [ -f ".server.pid" ]; then
    PID=$(cat .server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping server (PID: $PID)..."
        kill $PID
        rm .server.pid
        echo "✅ Server stopped"
    else
        echo "Server not running (PID $PID not found)"
        rm .server.pid
    fi
else
    echo "No server PID file found"
    echo "Trying to kill any process on port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✅ Killed process on port 8000" || echo "No process found on port 8000"
fi
