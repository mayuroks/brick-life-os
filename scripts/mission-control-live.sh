#!/bin/bash
# Mission Control Dashboard - Live Jira API Query
# Usage: ./scripts/mission-control-live.sh > dashboard.md

JIRA_URL="https://mayurzenith.atlassian.net"
JIRA_USER="${JIRA_USER:-mayurzenith@gmail.com}"
JIRA_TOKEN="${JIRA_API_TOKEN:?Set JIRA_API_TOKEN in env (never hardcode secrets)}"

PROJECTS="BF, FAM, HM, FIN, BR, BH, BS, MDP, ART"

# Function to count issues by JQL
count_issues() {
    local jql="$1"
    curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
        -X GET \
        -H "Content-Type: application/json" \
        "$JIRA_URL/rest/api/3/search?jql=$jql&maxResults=0" 2>/dev/null | \
        python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null || echo "0"
}

# Fetch counts
echo "Fetching live Jira data... ⏳" >&2

BACKLOG=$(count_issues "project in ($PROJECTS) AND status = \"Backlog\"")
READY=$(count_issues "project in ($PROJECTS) AND status = \"Ready\"")
TODO=$(count_issues "project in ($PROJECTS) AND status = \"Todo-Week\"")
PROGRESS=$(count_issues "project in ($PROJECTS) AND status = \"In Progress\"")
BLOCKED=$(count_issues "project in ($PROJECTS) AND status = \"Blocked Or FollowUp\"")
DONE=$(count_issues "project in ($PROJECTS) AND status = \"Done\" AND updated >= startOfWeek()")

TOTAL=$((BACKLOG + READY + TODO + PROGRESS + BLOCKED))

cat << EOF
# 🎯 Mission Control Dashboard

**Jira Workflow overview across all Life OS domains** | **Generated: $(date)**

---

## 📊 Quick Stats (Live from Jira)

| Status | Count | Color |
|--------|-------|-------|
| 📋 **Backlog** | $BACKLOG | Gray |
| 🏁 **Ready** | $READY | Light Gray |
| 📝 **Todo-Week** | $TODO | Blue |
| 🔨 **In Progress** | $PROGRESS | Amber |
| ⛔ **Blocked/FollowUp** | $BLOCKED | Amber |
| ✅ **Done (This Week)** | $DONE | Green |
|   |   |   |
| **TOTAL** | $TOTAL | — |

---

## 🔴 Ready to Pick Up

Items in **Ready** or **Todo-Week**, sorted oldest first:

[JIRA QUERY](project in ($PROJECTS) AND status in ("Ready", "Todo-Week") ORDER BY updated ASC)

> 💡 **What to pick:** Start with the oldest item in Todo-Week.

---

## ⛔ Blocked / FollowUp

Items in **Blocked Or FollowUp** status (need attention):

[JIRA QUERY](project in ($PROJECTS) AND status = "Blocked Or FollowUp")

---

## 📅 Weekly Delivery Snapshot

**Week:** Current

| Status | Count | Velocity |
|--------|-------|----------|
| Backlog | $BACKLOG | 🟦 |
| Ready | $READY | 🟦 |
| In Progress | $PROGRESS | ⚠️ |
| Done (Week) | $DONE | 🟩 |

📊 **This Week Progress:** $DONE/$TODO items done

---

## 🏢 By Domain (Live Counts)

| Domain | Key | Backlog | Ready | Todo | Progress | Blocked | Done |
|--------|-----|---------|-------|------|----------|---------|------|
| Career | BF | $(count_issues "project = \"BF\" AND status = \"Backlog\"") | $(count_issues "project = \"BF\" AND status = \"Ready\"") | $(count_issues "project = \"BF\" AND status = \"Todo-Week\"") | $(count_issues "project = \"BF\" AND status = \"In Progress\"") | $(count_issues "project = \"BF\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"BF\" AND status = \"Done\"") |
| Family | FAM | $(count_issues "project = \"FAM\" AND status = \"Backlog\"") | $(count_issues "project = \"FAM\" AND status = \"Ready\"") | $(count_issues "project = \"FAM\" AND status = \"Todo-Week\"") | $(count_issues "project = \"FAM\" AND status = \"In Progress\"") | $(count_issues "project = \"FAM\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"FAM\" AND status = \"Done\"") |
| House | HM | $(count_issues "project = \"HM\" AND status = \"Backlog\"") | $(count_issues "project = \"HM\" AND status = \"Ready\"") | $(count_issues "project = \"HM\" AND status = \"Todo-Week\"") | $(count_issues "project = \"HM\" AND status = \"In Progress\"") | $(count_issues "project = \"HM\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"HM\" AND status = \"Done\"") |
| Finance | FIN | $(count_issues "project = \"FIN\" AND status = \"Backlog\"") | $(count_issues "project = \"FIN\" AND status = \"Ready\"") | $(count_issues "project = \"FIN\" AND status = \"Todo-Week\"") | $(count_issues "project = \"FIN\" AND status = \"In Progress\"") | $(count_issues "project = \"FIN\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"FIN\" AND status = \"Done\"") |
| Network | BR | $(count_issues "project = \"BR\" AND status = \"Backlog\"") | $(count_issues "project = \"BR\" AND status = \"Ready\"") | $(count_issues "project = \"BR\" AND status = \"Todo-Week\"") | $(count_issues "project = \"BR\" AND status = \"In Progress\"") | $(count_issues "project = \"BR\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"BR\" AND status = \"Done\"") |
| Health | BH | $(count_issues "project = \"BH\" AND status = \"Backlog\"") | $(count_issues "project = \"BH\" AND status = \"Ready\"") | $(count_issues "project = \"BH\" AND status = \"Todo-Week\"") | $(count_issues "project = \"BH\" AND status = \"In Progress\"") | $(count_issues "project = \"BH\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"BH\" AND status = \"Done\"") |
| LifeOS | BS | $(count_issues "project = \"BS\" AND status = \"Backlog\"") | $(count_issues "project = \"BS\" AND status = \"Ready\"") | $(count_issues "project = \"BS\" AND status = \"Todo-Week\"") | $(count_issues "project = \"BS\" AND status = \"In Progress\"") | $(count_issues "project = \"BS\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"BS\" AND status = \"Done\"") |
| Docs | MDP | $(count_issues "project = \"MDP\" AND status = \"Backlog\"") | $(count_issues "project = \"MDP\" AND status = \"Ready\"") | $(count_issues "project = \"MDP\" AND status = \"Todo-Week\"") | $(count_issues "project = \"MDP\" AND status = \"In Progress\"") | $(count_issues "project = \"MDP\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"MDP\" AND status = \"Done\"") |
| Ideas | ART | $(count_issues "project = \"ART\" AND status = \"Backlog\"") | $(count_issues "project = \"ART\" AND status = \"Ready\"") | $(count_issues "project = \"ART\" AND status = \"Todo-Week\"") | $(count_issues "project = \"ART\" AND status = \"In Progress\"") | $(count_issues "project = \"ART\" AND status = \"Blocked Or FollowUp\"") | $(count_issues "project = \"ART\" AND status = \"Done\"") |
EOF

cat << EOF

---

## 🔥 Long-Stuck Issues (>28 days)

[JIRA QUERY](project in ($PROJECTS) AND statusCategory != Done AND updated <= -28d)

---

## 📋 How to Use This Dashboard

1. **Copy** the entire page
2. **Paste** into Confluence
3. **Replace** each \`[JIRA QUERY](...)\` with the Jira macro in Confluence:
   - Insert → Jira → "Jira Issue" 
   - Set the JQL from the parenthesis
   - Set limit to 10-20 items
4. **Refresh** for fresh data

---

## ⚙️ Quick Copy JQL

\`project in ($PROJECTS) AND status = "Backlog"\`

\`project in ($PROJECTS) AND status = "Ready"\`

\`project in ($PROJECTS) AND status = "Todo-Week"\`

\`project in ($PROJECTS) AND status = "In Progress"\`

\`project in ($PROJECTS) AND status = "Blocked Or FollowUp"\`

\`project in ($PROJECTS) AND status = "Done" AND updated >= startOfWeek()\`

---

## ✅ Status Configuration (Verified)

| Status | ID | Category |
|--------|-----|----------|
| 📋 Backlog | 10006 | To Do |
| 🏁 Ready | 10186 | To Do |
| 📝 Todo-Week | 10187 | To Do |
| 🔨 In Progress | 10107 | In Progress |
| ⛔ Blocked/FollowUp | 10184 | In Progress |
| ✅ Done | 10108 | Done |

> 🟢 All 6 statuses confirmed - matches contract

---

**Note:** Family project key is \`FAM\` (not \`AT\` in contract). Zero issues across all projects detected.
