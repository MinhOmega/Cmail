#!/usr/bin/env bash
# Configure the Admin self-update integration for a Cmail deployment.
#
# Sets, in one pass:
#   1. Worker secret  GITHUB_UPDATE_TOKEN   — PAT the Worker uses to read the repo
#      default branch and dispatch .github/workflows/deploy-update.yml.
#   2. Worker secret  GITHUB_UPDATE_REPO    — "owner/repository" of THIS installation repo.
#   3. Repo Actions secret CMAIL_UPDATE_TOKEN — PAT the workflow itself uses to
#      checkout with full history and push the update commit back.
#
# One fine-grained PAT covers all three: repository access = only this repo,
# permissions = Contents (Read & write) + Actions (Read & write).
#
# Usage (run from the repo root, wrangler logged in):
#   GITHUB_UPDATE_TOKEN=github_pat_xxx ./scripts/set-update-secrets.sh
# or:
#   ./scripts/set-update-secrets.sh github_pat_xxx
#
# The token is never echoed. Optionally override the repo:
#   GITHUB_UPDATE_REPO=owner/repo GITHUB_UPDATE_TOKEN=... ./scripts/set-update-secrets.sh
set -euo pipefail

TOKEN="${GITHUB_UPDATE_TOKEN:-${1:-}}"
REPO="${GITHUB_UPDATE_REPO:-MinhOmega/Cmail}"

if [ -z "${TOKEN}" ]; then
	echo "error: pass the token as GITHUB_UPDATE_TOKEN=<token> or as the first argument" >&2
	echo "       create one at https://github.com/settings/personal-access-tokens/new" >&2
	exit 1
fi

api() {
	curl -sS --max-time 20 -H "Authorization: Bearer ${TOKEN}" \
		-H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}

echo "==> validating token against ${REPO}"
STATUS=$(api -o /tmp/gh-update-check.json -w "%{http_code}" "https://api.github.com/repos/${REPO}")
if [ "${STATUS}" != "200" ]; then
	echo "error: GET /repos/${REPO} returned ${STATUS}" >&2
	cat /tmp/gh-update-check.json >&2
	exit 1
fi
DEFAULT_BRANCH=$(python3 -c "import json;print(json.load(open('/tmp/gh-update-check.json'))['default_branch'])")
rm -f /tmp/gh-update-check.json
echo "    ok (default branch: ${DEFAULT_BRANCH})"

echo "==> setting worker secret GITHUB_UPDATE_TOKEN"
printf '%s' "${TOKEN}" | npx wrangler secret put GITHUB_UPDATE_TOKEN

echo "==> setting worker secret GITHUB_UPDATE_REPO=${REPO}"
printf '%s' "${REPO}" | npx wrangler secret put GITHUB_UPDATE_REPO

echo "==> setting repo Actions secret CMAIL_UPDATE_TOKEN"
gh secret set CMAIL_UPDATE_TOKEN -R "${REPO}" --body "${TOKEN}"

echo
echo "Done. Admin → Update should now report both keys as configured."
echo "Reminder: dispatching the update workflow replaces this fork's tree with"
echo "the upstream tree (${UPDATE_SOURCE_REPOSITORY:-hieunc229/mailflare}) — only click Update if you mean it."
