#!/usr/bin/env bash

# This script starts the Pub/Sub emulator and creates the required topic
# using the REST API to avoid authentication issues
#
# See:
# https://cloud.google.com/pubsub/docs/emulator
# https://cloud.google.com/pubsub/docs/create-topic#pubsub_create_topic-rest

# Set defaults
HOST=0.0.0.0:8085
PROJECT_ID=${PUBSUB_PROJECT_ID:-traffic-analytics-dev}
TOPIC_NAME=${PUBSUB_TOPIC_PAGE_HITS_RAW:-traffic-analytics-page-hits-raw}

echo "Starting Pub/Sub emulator..."
echo "Host: $HOST"
echo "Project: $PROJECT_ID"
echo "Topic: $TOPIC_NAME"

# Start the emulator in the background
gcloud beta emulators pubsub start --host-port=${HOST} --project=${PROJECT_ID} &

# Wait for the emulator to be ready
until curl -f http://localhost:8085; do
    echo "Waiting for Pub/Sub emulator to start..."
    sleep 1
done

echo "Pub/Sub emulator is ready!"

# Create the topic via REST API
echo "Creating topic: $TOPIC_NAME"
if curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:8085/v1/projects/${PROJECT_ID}/topics/${TOPIC_NAME} | grep -q "200"; then
    echo "Topic created successfully: $TOPIC_NAME"
else
    echo "Failed to create topic: $TOPIC_NAME"
    exit 1
fi

# Verify topic was created by listing topics
echo "Verifying topic creation..."
curl -s http://localhost:8085/v1/projects/${PROJECT_ID}/topics

echo "Topic creation complete!"

# Create a file to signal that setup is complete
touch /tmp/pubsub-ready

# Keep the container running
tail -f /dev/null