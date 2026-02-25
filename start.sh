#!/bin/bash
echo "Starting Brand Monitor..."
echo ""

# Start backend
echo "[1/2] Starting API server on port 3001..."
cd "$(dirname "$0")/backend" && node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
for i in 1 2 3 4 5; do
  if curl -s http://localhost:3001/api/platforms > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo ""
echo "[2/2] Starting React dev server on port 3000..."
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "App is running at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'" EXIT
wait
