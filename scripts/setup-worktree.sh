#!/bin/bash

# Setup worktree configuration for Docker Compose
# Usage: ./scripts/setup-worktree.sh [PORT_OFFSET]

PORT_OFFSET=${1:-0}

# Get worktree name from current directory
WORKTREE_NAME=$(basename "$PWD")

# Calculate ports using addition
FIRESTORE_PORT=$((8080 + PORT_OFFSET * 100))
PUBSUB_PORT=$((8085 + PORT_OFFSET * 100))
ANALYTICS_PORT=$((3000 + PORT_OFFSET * 100))

# Generate .env file
cat > .env << EOF
# Auto-generated worktree configuration
# PORT_OFFSET: ${PORT_OFFSET}
# Worktree: ${WORKTREE_NAME}

PORT_OFFSET=${PORT_OFFSET}
COMPOSE_PROJECT_NAME=traffic-analytics-${WORKTREE_NAME}
FIRESTORE_PORT=${FIRESTORE_PORT}
PUBSUB_PORT=${PUBSUB_PORT}
ANALYTICS_PORT=${ANALYTICS_PORT}
EOF

echo "Generated .env for worktree '${WORKTREE_NAME}' with PORT_OFFSET=${PORT_OFFSET}:"
echo "  Project name: traffic-analytics-${WORKTREE_NAME}"
echo "  Firestore: ${FIRESTORE_PORT}"
echo "  PubSub: ${PUBSUB_PORT}"
echo "  Analytics: ${ANALYTICS_PORT}"