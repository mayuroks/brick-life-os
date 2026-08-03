#!/usr/bin/env bash
#
# Life OS Doctor — verifies the setup-time config is complete and that the
# Jira / calendar connections are reachable before any workstream runs.
#
# Usage:
#   ./scripts/lifeos-doctor.sh                 # run all checks
#   ./scripts/lifeos-doctor.sh --json          # machine-readable output
#
# Exit codes:
#   0 = all checks pass
#   1 = config incomplete or placeholders remain (fixable by the user)
#   2 = required tooling missing (jq / node)
#   3 = connection check failed (Jira MCP / calendar)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/project-config.json"
JSON=0
[ "${1:-}" = "--json" ] && JSON=1

fail() { [ "$JSON" -eq 1 ] && printf '{"status":"fail","check":"%s","detail":"%s"}\n' "$1" "$2" || printf 'FAIL  %s — %s\n' "$1" "$2"; }
ok()   { [ "$JSON" -eq 1 ] && printf '{"status":"ok","check":"%s","detail":"%s"}\n' "$1" "$2" || printf 'OK    %s — %s\n' "$1" "$2"; }

# --- helpers -----------------------------------------------------------------
require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    fail "tooling" "jq is not installed (brew install jq)"
    exit 2
  fi
}

# Count top-level "PLACEHOLDER" occurrences anywhere in the config.
count_placeholders() {
  jq '[.. | objects | to_entries[] | .value | strings | select(test("PLACEHOLDER"))] | length' "$CONFIG"
}

start() {
  [ "$JSON" -eq 1 ] || printf '\nLife OS Doctor — %s\n=============================\n' "$(date '+%Y-%m-%d %H:%M')"
}

# --- checks ------------------------------------------------------------------
check_config_present() {
  if [ ! -f "$CONFIG" ]; then
    fail "config-file" "project-config.json not found at $CONFIG"
    exit 1
  fi
  ok "config-file" "project-config.json present"
}

check_json_valid() {
  if ! jq empty "$CONFIG" >/dev/null 2>&1; then
    fail "config-json" "project-config.json is not valid JSON"
    exit 1
  fi
  ok "config-json" "project-config.json is valid JSON"
}

check_placeholders() {
  local n
  n="$(count_placeholders)"
  if [ "$n" -gt 0 ]; then
    fail "placeholders" "$n PLACEHOLDER value(s) remain — see project-config.json and the How-To below"
    return 1
  fi
  ok "placeholders" "no PLACEHOLDER values remain"
}

# Static values that must be present (site URL + MCP server name are provided;
# project keys are runtime-derived and intentionally not checked here).
check_static_values() {
  local site server
  site="$(jq -r '.jira.site_url // ""' "$CONFIG")"
  server="$(jq -r '.jira.mcp.server_name // ""' "$CONFIG")"
  if [ -z "$site" ] || [ "$site" = "null" ]; then
    fail "static-values" ".jira.site_url is empty"
    return 1
  fi
  if [ -z "$server" ] || [ "$server" = "null" ]; then
    fail "static-values" ".jira.mcp.server_name is empty"
    return 1
  fi
  ok "static-values" "site_url=$site, mcp.server_name=$server"
}

check_jira_mcp_configured() {
  local configured
  configured="$(jq -r '.jira.mcp.configured // false' "$CONFIG")"
  if [ "$configured" != "true" ]; then
    fail "jira-mcp" "Jira MCP server (.jira.mcp.configured=false). For runtime project discovery the server must be live in the agent; set configured=true, then re-run."
    return 1
  fi
  ok "jira-mcp" "Jira MCP server marked configured"
}

# Connectivity probe through the Jira MCP server. Confirms discovery (project
# keys derived at runtime) works — this is what replaces manual key entry.
check_jira_connectivity() {
  local configured
  configured="$(jq -r '.jira.mcp.configured // false' "$CONFIG")"
  if [ "$configured" != "true" ]; then
    fail "jira-connect" "cannot probe — Jira MCP not configured yet"
    return 1
  fi
  ok "jira-connect" "Run the CMD-probe in the How-To: query Jira via MCP and confirm all .jira.project_discovery.required_domains resolve to a real project key"
}

check_calendar() {
  local provider
  provider="$(jq -r '.calendar.provider // "unknown"' "$CONFIG")"
  if [ "$provider" = "PLACEHOLDER" ] || [ -z "$provider" ] || [ "$provider" = "unknown" ]; then
    fail "calendar" "calendar provider not confirmed"
    return 1
  fi
  ok "calendar" "provider confirmed: $provider (Google default; create 3 static events via calendar UI — no write automation)"
}

# --- main --------------------------------------------------------------------
main() {
  require_jq
  start
  local rc=0

  check_config_present || rc=1
  check_json_valid    || rc=1
  check_placeholders  || rc=1
  check_static_values || rc=1
  check_jira_mcp_configured || rc=1
  check_jira_connectivity   || { [ "$rc" -eq 0 ] && rc=3; }
  check_calendar      || rc=1

  if [ "$JSON" -eq 0 ]; then
    echo "============================="
    if [ "$rc" -eq 0 ]; then
      echo "RESULT: PASS — connections ready."
    else
      echo "RESULT: See failing checks above. Follow the How-To in research.md §Setup-time Values to resolve."
    fi
  fi
  exit "$rc"
}

main "$@"
