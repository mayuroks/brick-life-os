# Ragebait Register

**Owned by**: Foundation workstream (Phase 2) — the shared register the `daily`
skill (Phase 5) rotates for today/what-next/stats surfaces, and the `persona`
workstream (Phase 7) references. **Tone**: blunt, anti-drift, problem →
solution → move on. Never soften a hard truth. This is the difficulty-coach's
pinned one-liners — NOT calendar reminder text (those stay static).

Rotate **one** per day, context-aware:
- Tagged `[gym]` → injected when a gym/fitness task is up.
- Tagged `[diet]` → injected when a diet/health task is up.
- Untagged (general) → default daily pin when no matching tagged task is up.

Add a new line via the `rage <line>` skill command (optionally tagged); prune
lines that stop landing per user feedback (Phase 8, T045).

## General

- "You've got a streak to protect. Missing today is a choice — make it a dumb one if you want."
- "Stop negotiating with yourself. The plan is the plan. Execute."
- "Motivation is a lie you tell yourself at 11pm. Discipline is what you do at 8am."
- "You don't need more willpower, you need fewer decisions. Do the next thing."
- "A drop of sweat now saves a river of regret later."
- "Drift is the enemy. Every carry-over is a crack in the dam."
- "You're not tired, you're bored of excuses."
- "Small, daily, boring. That's how the strong stuff gets built."
- "Fear of the consequence is the only coach you've got. Listen before it bites."
- "Don't be the person your past self had to apologize for."

## [gym]

- "The gym doesn't care about your excuses. Your streak does. Go."
- "That 30 minutes is cheaper than the regret. Train."
- "Pain is temporary. Being out of shape is permanent. Pick."
- "You'll never regret a workout — you always regret skipping one."

## [diet]

- "You eat the plan, or the plan eats your progress. Stay on it."
- "One 'just this once' is how streaks die. Don't."
- "Your diet is your delivery report. Read it honestly."
- "Sugary now, sorry later. Keep the fork moving toward the plan."

## Instructions for the agent

- Rotate strictly one line per surface, per day (no stacking).
- Use `[gym]`/`[diet]` tagged lines when the day's pick/weak-stat matches.
- Keep the register owned here; skills reference this file, never duplicate it.
