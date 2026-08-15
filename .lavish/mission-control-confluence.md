# 🎯 Mission Control Dashboard

**Jira Workflow overview across all Life OS domains** | **Generated: Mon Aug 10 22:20:37 IST 2026**

---

## 📊 Quick Stats (Live from Jira)

| Status | Count | Color |
|--------|-------|-------|
| 📋 **Backlog** | 0 | Gray |
| 🏁 **Ready** | 0 | Light Gray |
| 📝 **Todo-Week** | 0 | Blue |
| 🔨 **In Progress** | 0 | Amber |
| ⛔ **Blocked/FollowUp** | 0 | Amber |
| ✅ **Done (This Week)** | 0 | Green |
|   |   |   |
| **TOTAL** | 0 | — |

---

## 🔴 Ready to Pick Up

Items in **Ready** or **Todo-Week**, sorted oldest first:

[JIRA QUERY](project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status in ("Ready", "Todo-Week") ORDER BY updated ASC)

> 💡 **What to pick:** Start with the oldest item in Todo-Week.

---

## ⛔ Blocked / FollowUp

Items in **Blocked Or FollowUp** status (need attention):

[JIRA QUERY](project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Blocked Or FollowUp")

---

## 📅 Weekly Delivery Snapshot

**Week:** Current

| Status | Count | Velocity |
|--------|-------|----------|
| Backlog | 0 | 🟦 |
| Ready | 0 | 🟦 |
| In Progress | 0 | ⚠️ |
| Done (Week) | 0 | 🟩 |

📊 **This Week Progress:** 0/0 items done

---

## 🏢 By Domain (Live Counts)

| Domain | Key | Backlog | Ready | Todo | Progress | Blocked | Done |
|--------|-----|---------|-------|------|----------|---------|------|
| Career | BF | 0 | 0 | 0 | 0 | 0 | 0 |
| Family | FAM | 0 | 0 | 0 | 0 | 0 | 0 |
| House | HM | 0 | 0 | 0 | 0 | 0 | 0 |
| Finance | FIN | 0 | 0 | 0 | 0 | 0 | 0 |
| Network | BR | 0 | 0 | 0 | 0 | 0 | 0 |
| Health | BH | 0 | 0 | 0 | 0 | 0 | 0 |
| LifeOS | BS | 0 | 0 | 0 | 0 | 0 | 0 |
| Docs | MDP | 0 | 0 | 0 | 0 | 0 | 0 |
| Ideas | ART | 0 | 0 | 0 | 0 | 0 | 0 |

---

## 🔥 Long-Stuck Issues (>28 days)

[JIRA QUERY](project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND statusCategory != Done AND updated <= -28d)

---

## 📋 How to Use This Dashboard

1. **Copy** the entire page
2. **Paste** into Confluence
3. **Replace** each `[JIRA QUERY](...)` with the Jira macro in Confluence:
   - Insert → Jira → "Jira Issue" 
   - Set the JQL from the parenthesis
   - Set limit to 10-20 items
4. **Refresh** for fresh data

---

## ⚙️ Quick Copy JQL

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Backlog"`

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Ready"`

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Todo-Week"`

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "In Progress"`

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Blocked Or FollowUp"`

`project in (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART, NSH) AND status = "Done" AND updated >= startOfWeek()`

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

**Note:** Family project key is `FAM` (not `AT` in contract). Zero issues across all projects detected.
