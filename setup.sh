#!/bin/bash

echo "🇿🇦 ShiftManager Setup"
echo "========================"

# Install backend deps
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Install frontend deps
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the app, run: ./start.sh"
