#!/bin/bash

# Test script to send multiple requests matching the page-hit-request schema
# Usage: ./scripts/send-test-request.sh [COUNT]

# Default values
URL="http://localhost:3000"
TOKEN="test-token-123"
COUNT="${1:-10}"

# Generate UUIDs for the request
SITE_UUID="12345678-1234-1234-1234-123456789abc"
POST_UUID="87654321-4321-4321-4321-cba987654321"
MEMBER_UUID="11111111-2222-3333-4444-555555555555"

# Current timestamp in ISO8601 format
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "Sending ${COUNT} requests to: ${URL}/api/v1/page_hit"
echo "Using token: ${TOKEN}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Function to send a single request
send_request() {
  local request_num=$1
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  
  echo "Sending request ${request_num}/${COUNT}..."
  
  curl -X POST "${URL}/api/v1/page_hit?token=${TOKEN}&name=analytics_events" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \
    -H "X-Site-UUID: ${SITE_UUID}" \
    -H "Referer: https://example.com/previous-page" \
    -d "{
      \"timestamp\": \"${timestamp}\",
      \"action\": \"page_hit\",
      \"version\": \"1\",
      \"session_id\": \"session-abc123-${request_num}\",
      \"payload\": {
        \"user-agent\": \"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\",
        \"locale\": \"en-US\",
        \"location\": \"San Francisco, CA\",
        \"referrer\": \"https://google.com/search?q=example\",
        \"pathname\": \"/blog/test-article\",
        \"href\": \"https://example.com/blog/test-article\",
        \"site_uuid\": \"${SITE_UUID}\",
        \"post_uuid\": \"${POST_UUID}\",
        \"post_type\": \"post\",
        \"member_uuid\": \"${MEMBER_UUID}\",
        \"member_status\": \"paid\"
      }
    }" \
    -w "\nRequest ${request_num} - Status: %{http_code} - Time: %{time_total}s\n" \
    -v
}

# Send requests in rapid succession
for ((i=1; i<=COUNT; i++)); do
  send_request $i
done

# Wait for all background requests to complete
wait

echo ""
echo "All ${COUNT} requests completed!"