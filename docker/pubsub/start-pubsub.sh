#!/bin/bash

# Start the Pub/Sub emulator in the background
echo "Starting Pub/Sub emulator..."
gcloud beta emulators pubsub start --host-port=0.0.0.0:8085 --project=${PUBSUB_PROJECT_ID:-traffic-analytics-dev} &

# Wait for the emulator to be ready
echo "Waiting for Pub/Sub emulator to be ready..."
timeout=30
counter=0

while ! curl -s http://localhost:8085 > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        echo "Timeout waiting for Pub/Sub emulator to start"
        exit 1
    fi
done

echo "Pub/Sub emulator is ready!"

# Create the required topics
echo "Creating topics..."

# Set environment variable for gcloud commands
export PUBSUB_EMULATOR_HOST=localhost:8085

# Create page hits raw topic
if [ ! -z "$PUBSUB_TOPIC_PAGE_HITS_RAW" ]; then
    echo "Creating topic: $PUBSUB_TOPIC_PAGE_HITS_RAW"
    gcloud pubsub topics create "$PUBSUB_TOPIC_PAGE_HITS_RAW" --project=${PUBSUB_PROJECT_ID:-traffic-analytics-dev} 2>/dev/null || echo "Topic $PUBSUB_TOPIC_PAGE_HITS_RAW already exists"
else
    # Default topic name for development
    echo "Creating default topic: traffic-analytics-page-hits-raw"
    gcloud pubsub topics create "traffic-analytics-page-hits-raw" --project=${PUBSUB_PROJECT_ID:-traffic-analytics-dev} 2>/dev/null || echo "Topic traffic-analytics-page-hits-raw already exists"
fi

echo "Topic creation complete!"

# Create a file to signal that setup is complete
touch /tmp/pubsub-ready

# Keep the script running (since the emulator is running in background)
wait