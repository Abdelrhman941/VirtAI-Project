#!/bin/bash

# Start the development server in the background
npm run dev &

# Wait a moment for the server to start
sleep 3

# Open the browser (works on Windows with Git Bash)
if command -v start &> /dev/null; then
    # Windows
    start http://localhost:5173
elif command -v open &> /dev/null; then
    # macOS
    open http://localhost:5173
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:5173
else
    echo "Browser opened automatically is not supported on this system."
    echo "Please open http://localhost:5173 manually."
fi

# Wait for the npm process
wait
