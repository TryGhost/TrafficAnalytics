#!/bin/bash

# Signal handler for graceful shutdown
shutdown() {
    echo "Received shutdown signal, stopping Firestore emulator..."
    if [ ! -z "$FIRESTORE_PID" ]; then
        kill -TERM "$FIRESTORE_PID"
        wait "$FIRESTORE_PID"
    fi
    exit 0
}

# Set up signal trap
trap shutdown SIGTERM SIGINT

# Start Firestore emulator in background
gcloud emulators firestore start --host-port=0.0.0.0:8080 &
FIRESTORE_PID=$!

# Wait for the background process
wait "$FIRESTORE_PID"