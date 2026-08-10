#!/bin/bash
# Mission Control JQL Generator
# Generates JQL queries for all Life OS domains

PROJECTS="BF, FAM, HM, FIN, BR, BH, BS, MDP, ART"

echo "# Mission Control Dashboard - JQL Queries"
echo ""
echo "## Quick Status Counts"
echo "| Status | JQL |"
echo "|--------|-----|"
echo "| Backlog | project in ($PROJECTS) AND status = \"Backlog\" |"
echo "| Ready | project in ($PROJECTS) AND status = \"Ready\" |"
echo "| Todo-Week | project in ($PROJECTS) AND status = \"Todo-Week\" |"
echo "| In Progress | project in ($PROJECTS) AND status = \"In Progress\" |"
echo "| Waiting | project in ($PROJECTS) AND status = \"Waiting\" |"
echo "| Done (All Time) | project in ($PROJECTS) AND status = \"Done\" |"
echo ""
echo "## Weekly Filters"
echo "| Metric | JQL |"
echo "|--------|-----|"
echo "| Done This Week | project in ($PROJECTS) AND status = \"Done\" AND updated >= startOfWeek() |"
echo "| Todo-Week Items | project in ($PROJECTS) AND status = \"Todo-Week\" |"
echo "| Ready Items | project in ($PROJECTS) AND status = \"Ready\" |"
echo "| In Progress Items | project in ($PROJECTS) AND status = \"In Progress\" |"
echo "| Blocked Items | project in ($PROJECTS) AND status = \"Waiting\" |"
echo ""
echo "## By Domain Tables"
echo "| Domain | Backlog | Ready | Todo | In Progress | Waiting | Done |"
echo "|--------|---------|-------|------|-------------|---------|------|"

domains=("Career:BF" "Family:FAM" "House:HM" "Finance:FIN" "Network:BR" "Health: BH" "LifeOS:BS" "Docs:MDP" "Ideas:ART")

for domain in "${domains[@]}"; do
    IFS=':' read -r name key <<< "$domain"
    backlog=$(echo "project = \"$key\" AND status = \"Backlog\" | wc -l | tr -d ' '")
    ready=$(echo "project = \"$key\" AND status = \"Ready\" | wc -l | tr -d ' '")
    todo=$(echo "project = \"$key\" AND status = \"Todo-Week\" | wc -l | tr -d ' '")
    inprog=$(echo "project = \"$key\" AND status = \"In Progress\" | wc -l | tr -d ' '")
    waiting=$(echo "project = \"$key\" AND status = \"Waiting\" | wc -l | tr -d ' '")
    done=$(echo "project = \"$key\" AND status = \"Done\" | wc -l | tr -d ' '")
    echo "| $name | $backlog | $ready | $todo | $inprog | $waiting | $done |"
done
