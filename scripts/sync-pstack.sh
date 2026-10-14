#!/usr/bin/env bash
# Sync upstream Cursor pstack plugin skills/agents into repo discovery paths.
# Idempotent. Safe for Cloud Agent environment.json install and local use.
#
# Why: marketplace plugins (including pstack) do not load reliably into Cloud
# Agents. Committing the skill tree under .cursor/skills/pstack makes
# /poteto-mode and siblings available from the checkout everywhere Cursor,
# Claude Code, and Codex look for project skills.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${PSTACK_REF:-main}"
TMP="${PSTACK_SYNC_TMP:-${TMPDIR:-/tmp}/pstack-sync-$$}"
DEST_SKILLS="${ROOT}/.cursor/skills/pstack"
DEST_CURSOR_AGENTS="${ROOT}/.cursor/agents"
DEST_CLAUDE_AGENTS="${ROOT}/.claude/agents"
DEST_AGENTS_AGENTS="${ROOT}/.agents/agents"

cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "sync-pstack: missing required command: $1" >&2
    exit 1
  }
}

need_cmd git
need_cmd python3

mkdir -p "${TMP}"
git clone --quiet --depth 1 --filter=blob:none --sparse \
  --branch "${REF}" https://github.com/cursor/plugins.git "${TMP}/plugins"
git -C "${TMP}/plugins" sparse-checkout set pstack

PIN="$(git -C "${TMP}/plugins" rev-parse HEAD)"
VER="$(python3 -c "import json; print(json.load(open('${TMP}/plugins/pstack/.cursor-plugin/plugin.json'))['version'])")"

rm -rf "${DEST_SKILLS}"
mkdir -p "${DEST_SKILLS}" "${DEST_CURSOR_AGENTS}" "${DEST_CLAUDE_AGENTS}" "${DEST_AGENTS_AGENTS}"
cp -a "${TMP}/plugins/pstack/skills/." "${DEST_SKILLS}/"
cp -a "${TMP}/plugins/pstack/LICENSE" "${DEST_SKILLS}/LICENSE"
mkdir -p "${DEST_SKILLS}/.cursor-plugin"
cp -a "${TMP}/plugins/pstack/.cursor-plugin/plugin.json" "${DEST_SKILLS}/.cursor-plugin/plugin.json"

cat > "${DEST_SKILLS}/SOURCE.md" <<EOF
# Vendored pstack skills

- Upstream: https://github.com/cursor/plugins/tree/main/pstack
- Plugin version: ${VER}
- Git commit: ${PIN}
- Synced by: scripts/sync-pstack.sh
- Ref: ${REF}
- License: MIT (see LICENSE in this directory). Copyright (c) 2026 Lauren Tan.

Cloud Agents do not reliably load marketplace plugins. These skills are
committed so /poteto-mode and the rest of the pstack tree resolve from the
repo checkout.
EOF

cp -a "${TMP}/plugins/pstack/agents/poteto-agent.md" "${DEST_CURSOR_AGENTS}/poteto-agent.md"
cp -a "${TMP}/plugins/pstack/agents/comment-sicko.md" "${DEST_CURSOR_AGENTS}/comment-sicko.md"
cp -a "${TMP}/plugins/pstack/agents/poteto-agent.md" "${DEST_CLAUDE_AGENTS}/poteto-agent.md"
cp -a "${TMP}/plugins/pstack/agents/comment-sicko.md" "${DEST_CLAUDE_AGENTS}/comment-sicko.md"
cp -a "${TMP}/plugins/pstack/agents/." "${DEST_AGENTS_AGENTS}/"

# Relative symlinks so Claude / Codex / .agents all share one tree
mkdir -p "${ROOT}/.claude/skills" "${ROOT}/.codex/skills" "${ROOT}/.agents/skills"
ln -sfn ../../.cursor/skills/pstack "${ROOT}/.claude/skills/pstack"
ln -sfn ../../.cursor/skills/pstack "${ROOT}/.codex/skills/pstack"
ln -sfn ../../.cursor/skills/pstack "${ROOT}/.agents/skills/pstack"

SKILL_COUNT="$(find "${DEST_SKILLS}" -name SKILL.md | wc -l | tr -d ' ')"
echo "sync-pstack: ok version=${VER} commit=${PIN} skills=${SKILL_COUNT}"
