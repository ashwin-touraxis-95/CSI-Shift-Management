#!/bin/bash
echo "🚀 Starting ShiftManager..."

# Start backend
cd backend && node server.js &
BACKEND_PID=$!

# Start frontend
cd ../frontend && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ ShiftManager is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
