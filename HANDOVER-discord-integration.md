# Agent Handover: Project "Brick" (Discord-Jira Bot POC)

## Objective
Deploy a 24/7 serverless/cloud-hosted minimal AI bot ("Brick") on Render's free tier, connecting Discord webhooks to OpenRouter for remote querying while traveling.

## Current State & Architecture
* **Stack:** Node.js (Express), Docker, OpenRouter API (Claude 3.5 Sonnet / target model).
* **Components:**
  * `/discord` endpoint: Handles Discord interaction verification and command payloads.
  * `/health` endpoint: Used for external uptime pings to prevent Render free-tier spin-down.
  * System Prompt: Hardcoded persona ("Brick", blunt Jira coach, brick-red theme `#B7410E`, emoji-prefixed responses `🔥 **Brick says:**`).
* **Deployment:** Render Web Service (Docker environment) driven via a GitHub repo.

## Action Items / Next Steps
1. **Repository Setup:** Scaffold `server.js`, `package.json`, and `Dockerfile` locally.
2. **Environment Configuration:** Secure `OPENROUTER_API_KEY`, `JIRA_API_TOKEN`, etc., via Render environment variables (never commit `.env`).
3. **Discord Portal:** Configure Interactions Endpoint URL to point to the live Render deployment URL.
4. **Keep-Alive:** Attach an external cron pinger (e.g., UptimeRobot) to hit `/health` every 10 minutes.
