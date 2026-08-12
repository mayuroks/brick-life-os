#!/usr/bin/env bash
# Staleness gate for the AWS deploy surface. Read-only — never provisions or
# deletes anything. Fails on stale deploy markers in any file that is NOT:
#   - under an archived/history dir (specs/, openspec/, deprecated/, node_modules/,
#     .aws-cli-v2/, .git/), or
#   - its own deploy-truth file (deploy/README.md), or
#   - carrying an explicit "[LEGACY/ARCHIVED]" banner.
# The deploy truth is singular: deploy/README.md. A future agent must not
# re-introduce Fargate / us-east-1 / Render / App Runner / SSM / ECR / /ecs/ /
# ECS-Exec / CloudWatch / DISABLE_VOICE as if current.
#
# Usage:   bash scripts/aws-stale-check.sh
# Exit:    0 = clean; 1 = stale markers found (list them).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Archived / generated dirs that are exempt wholesale.
EXEMPT_DIRS='specs/ openspec/ deprecated/ node_modules/ .aws-cli-v2/ .git/ .lavish/'
# The single source of deploy truth: it is expected to NAME the legacy markers
# so future agents can recognize them, so it is exempt.
TRUTH_FILE='deploy/README.md'

# CURRENT Render dashboard hosting deploy (feature 013): these root-level files
# are the live Render free-tier deploy for life-map-dashboard/. They are NOT
# stale/legacy AWS markers — exempt them so the gate doesn't misfire on the
# legitimate Render deployment. The AWS/EC2 discord-agent deploy is separate.
RENDER_DEPLOY_FILES='render.yaml Dockerfile .dockerignore'

# Token-precise markers. Pattern avoids false positives: \bECR\b does not match
# "secret"; "Render" the verb (render agent/opencode.json) is not matched, only
# Render the retired host. /ecs/ is the CloudWatch log-group path used only by
# the dead Fargate path.
PATTERN='(FARGATE|[Uu][Ss]-[Ee]ast-[0-9]|[Aa]pp ?[Rr]unner|\bDISABLE_VOICE\b|SSM [Pp]arameter|[Rr]ender (free|blueprint|dashboard|service|Web|Web Service)|\bECR\b|/ecs/|ECS[- ]?Exec|CloudWatch)'

get_banner_prefix() {
  echo "$1" | awk '{ print substr($0, 1, index($0,"[LEGACY/ARCHIVED]")-1) }'
}

fail=0

while IFS= read -r -d '' f; do
  rel="${f#./}"
  # Skip deleted files (git index may still reference removed paths).
  [[ -e "$f" ]] || continue
  # Skip exempt dirs
  skip=0
  for d in $EXEMPT_DIRS; do
    case "$rel" in
      "$d"*|*/"$d"*) skip=1; break ;;
    esac
  done
  [ "$skip" = 1 ] && continue
  # Skip the truth file
  [ "$rel" = "$TRUTH_FILE" ] && continue
  # Skip the current Render dashboard deploy files (feature 013)
  for r in $RENDER_DEPLOY_FILES; do
    [ "$rel" = "$r" ] && skip=1 && break
  done
  [ "$skip" = 1 ] && continue
  # Skip files carrying an explicit legacy-archive banner
  if rg -q '\[LEGACY/ARCHIVED\]' "$f"; then
    continue
  fi

  # Report each matching line.
  if rg -n "$PATTERN" "$f" 2>/dev/null; then
    fail=1
    echo "  ^-- stale marker in $rel"
  fi
done < <(git ls-files -z 2>/dev/null || find . -type f -print0)

if [ "$fail" = 1 ]; then
  echo
  echo "FAIL: AWS deploy staleness gate found stale markers above."
  echo "Fix them, OR add a '[LEGACY/ARCHIVED]' banner to the file, OR move it"
  echo "under specs//openspec//deprecated/ history. Deploy truth = deploy/README.md."
  exit 1
fi

echo "OK: no stale AWS deploy markers outside archived history / deploy truth."
exit 0