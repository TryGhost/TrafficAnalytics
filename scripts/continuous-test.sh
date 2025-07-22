#!/bin/bash

# Continuous test script that runs send-test-request.sh with 1 request in a loop
# Usage: ./scripts/continuous-test.sh
# Press Ctrl+C to stop

echo "Starting continuous test loop - sending 1 request at a time"
echo "Press Ctrl+C to stop"
echo ""

# Counter for tracking total requests
counter=1

# Trap SIGINT (Ctrl+C) to exit gracefully and show total
trap 'echo ""; echo "Stopping continuous test..."; echo "Total requests sent: $((counter - 1))"; exit 0' INT

while true; do
    echo "=== Continuous Request #${counter} ==="
    ./send-test-request.sh 1
    
    echo ""
    echo "Request #${counter} completed. Starting next request..."
    echo ""
    
    ((counter++))
done