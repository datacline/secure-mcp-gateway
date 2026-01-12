#!/bin/sh
#
# MCP Gateway Hook Script for Cursor
# .cursor/mcp-gateway-hook.sh
#
# Intercepts MCP tool execution calls and checks policy with the SaaS gateway.
# This script runs via the Cursor beforeMCPExecution hook to enforce security policies.
#
# Installation:
#   1. Copy this script to ~/.cursor/mcp-gateway-hook.sh
#   2. Make it executable: chmod +x ~/.cursor/mcp-gateway-hook.sh
#   3. Configure the API endpoint and key below
#   4. Add to hooks.json:
#      {
#        "beforeMCPExecution": "~/.cursor/mcp-gateway-hook.sh"
#      }
#
# Configuration:
#   - Set MCP_GATEWAY_API_URL environment variable or configure below
#   - Set MCP_GATEWAY_API_KEY environment variable or configure below
#   - Optionally set MCP_GATEWAY_FAIL_OPEN=true for allow-by-default on failures
#

set -e

# ============================================================================
# Configuration
# ============================================================================

# Gateway API endpoint for policy checks
# Override via environment variable: MCP_GATEWAY_API_URL
GATEWAY_API_URL="${MCP_GATEWAY_API_URL:-https://api.yoursaas.com/api/v1/check-mcp-policy}"

# API key for authentication (unique per customer/device)
# Override via environment variable: MCP_GATEWAY_API_KEY
GATEWAY_API_KEY="${MCP_GATEWAY_API_KEY:-}"

# Timeout for gateway API calls (seconds)
# Override via environment variable: MCP_GATEWAY_TIMEOUT
GATEWAY_TIMEOUT="${MCP_GATEWAY_TIMEOUT:-5}"

# Fail-open behavior: if "true", allow execution if gateway is unreachable
# Override via environment variable: MCP_GATEWAY_FAIL_OPEN
FAIL_OPEN="${MCP_GATEWAY_FAIL_OPEN:-false}"

# ============================================================================
# Utility Functions
# ============================================================================

log_debug() {
  # Only output if DEBUG is enabled
  if [ "${MCP_GATEWAY_DEBUG:-false}" = "true" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG: $*" >&2
  fi
}

log_error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

log_info() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*" >&2
}

# Check required dependencies
check_dependencies() {
  for cmd in curl jq; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      log_error "Required command not found: $cmd"
      log_error "Please install $cmd and try again."
      return 1
    fi
  done
  return 0
}

# Validate configuration
validate_config() {
  if [ -z "$GATEWAY_API_URL" ]; then
    log_error "GATEWAY_API_URL is not configured"
    log_error "Set MCP_GATEWAY_API_URL environment variable or edit this script"
    return 1
  fi

  if [ -z "$GATEWAY_API_KEY" ]; then
    log_error "GATEWAY_API_KEY is not configured"
    log_error "Set MCP_GATEWAY_API_KEY environment variable or edit this script"
    return 1
  fi

  return 0
}

# Create default deny response
deny_response() {
  local message="${1:-Access denied by policy enforcement}"
  jq -n \
    --arg permission "deny" \
    --arg msg "$message" \
    '{permission: $permission, continue: false, userMessage: $msg}'
}

# Create default allow response
allow_response() {
  jq -n '{permission: "allow", continue: true}'
}

# ============================================================================
# Main Policy Check Logic
# ============================================================================

# Read MCP execution request from stdin
read_payload() {
  cat
}

# Send policy check request to gateway and handle response
check_policy() {
  local payload="$1"

  log_debug "Sending policy check to: $GATEWAY_API_URL"
  log_debug "Payload: $payload"

  # Make API request with timeout and error handling
  local http_response
  local http_status
  local response_body
  local curl_exit_code

  # Create temporary file for response headers
  local temp_headers
  temp_headers=$(mktemp)
  trap "rm -f $temp_headers" EXIT

  # Make the request
  http_response=$(
    curl -s -w "\n%{http_code}" \
      --max-time "$GATEWAY_TIMEOUT" \
      -X POST "$GATEWAY_API_URL" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $GATEWAY_API_KEY" \
      -H "User-Agent: mcp-gateway-hook/1.0" \
      -d "$payload" \
      2>/dev/null || echo "CURL_ERROR"
  )
  curl_exit_code=$?

  # Parse response
  http_status=$(echo "$http_response" | tail -n 1)
  response_body=$(echo "$http_response" | sed '$d')

  # Handle curl errors (network failure, timeout, etc.)
  if [ "$http_status" = "CURL_ERROR" ] || [ $curl_exit_code -ne 0 ]; then
    log_error "Failed to reach gateway API (curl exit code: $curl_exit_code)"
    handle_gateway_unavailable
    return
  fi

  # Handle HTTP error responses
  if [ -z "$http_status" ] || [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
    log_error "Gateway returned HTTP $http_status"
    log_debug "Response: $response_body"
    handle_gateway_error "$http_status" "$response_body"
    return
  fi

  # Validate JSON response
  if ! echo "$response_body" | jq empty 2>/dev/null; then
    log_error "Invalid JSON response from gateway"
    log_debug "Response: $response_body"
    handle_invalid_response
    return
  fi

  # Extract decision fields
  local permission
  local continue_flag
  local user_message

  permission=$(echo "$response_body" | jq -r '.permission // "deny"')
  continue_flag=$(echo "$response_body" | jq -r '.continue // false')
  user_message=$(echo "$response_body" | jq -r '.userMessage // ""')

  log_debug "Policy decision: permission=$permission, continue=$continue_flag"

  # Output the decision to Cursor
  if [ "$permission" = "allow" ]; then
    allow_response
  else
    deny_response "$user_message"
  fi
}

# Handle gateway unavailable (network failure, timeout, etc.)
handle_gateway_unavailable() {
  log_error "Gateway is unreachable"

  if [ "$FAIL_OPEN" = "true" ]; then
    log_info "FAIL_OPEN is enabled; allowing execution"
    allow_response
  else
    log_info "FAIL_OPEN is disabled; denying execution"
    deny_response "Security gateway is temporarily unavailable. Please try again."
  fi
}

# Handle gateway error response (HTTP 4xx, 5xx)
handle_gateway_error() {
  local http_status="$1"
  local response_body="$2"

  # Try to extract error message from response
  local error_message
  error_message=$(echo "$response_body" | jq -r '.error // .message // ""' 2>/dev/null || echo "")

  if [ -z "$error_message" ]; then
    error_message="Policy evaluation failed (HTTP $http_status)"
  fi

  if [ "$FAIL_OPEN" = "true" ]; then
    log_info "FAIL_OPEN is enabled; allowing execution despite error"
    allow_response
  else
    log_info "Denying execution due to gateway error"
    deny_response "Policy enforcement service error: $error_message"
  fi
}

# Handle invalid JSON response
handle_invalid_response() {
  if [ "$FAIL_OPEN" = "true" ]; then
    log_info "FAIL_OPEN is enabled; allowing execution despite invalid response"
    allow_response
  else
    log_info "Denying execution due to invalid gateway response"
    deny_response "Policy enforcement service returned invalid response"
  fi
}

# ============================================================================
# Entry Point
# ============================================================================

main() {
  log_debug "MCP Gateway Hook started"
  log_debug "Gateway URL: $GATEWAY_API_URL"

  # Check dependencies
  if ! check_dependencies; then
    log_error "Dependency check failed"
    deny_response "MCP hook script is misconfigured"
    exit 1
  fi

  # Validate configuration
  if ! validate_config; then
    log_error "Configuration validation failed"
    deny_response "MCP hook script is not configured"
    exit 1
  fi

  # Read payload from stdin
  local payload
  payload=$(read_payload)

  if [ -z "$payload" ]; then
    log_error "No payload received on stdin"
    deny_response "Invalid MCP execution request"
    exit 1
  fi

  log_debug "Received payload: $payload"

  # Check policy with gateway
  check_policy "$payload"
}

# Run main function
main "$@"
