#!/usr/bin/env bash
# Ensure pstack skills are present for this machine's agent discovery paths.
# Idempotent. Prefer the repo-vendored tree; fall back to a fresh upstream sync
# into the checkout when skills are missing (e.g. partial clones).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_SKILLS="${ROOT}/.cursor/skills/pstack"

if [[ ! -f "${REPO_SKILLS}/poteto-mode/SKILL.md" ]]; then
  echo "ensure-pstack: repo skills missing; running sync-pstack.sh"
  bash "${ROOT}/scripts/sync-pstack.sh"
fi

# Also mirror into $HOME so user-level discovery works on this VM (Cloud Agent
# snapshot / local shell). Does not replace the committed project tree.
for home_root in \
  "${HOME}/.cursor/skills/pstack" \
  "${HOME}/.claude/skills/pstack" \
  "${HOME}/.codex/skills/pstack" \
  "${HOME}/.agents/skills/pstack"
do
  mkdir -p "$(dirname "${home_root}")"
  rm -rf "${home_root}"
  cp -a "${REPO_SKILLS}" "${home_root}"
done

# poteto-agent looks under ~/.cursor/plugins for a path ending in
# skills/poteto-mode/SKILL.md. Point that search at the vendored tree.
mkdir -p "${HOME}/.cursor/plugins/pstack/.cursor-plugin"
ln -sfn "${REPO_SKILLS}" "${HOME}/.cursor/plugins/pstack/skills"
if [[ -f "${REPO_SKILLS}/.cursor-plugin/plugin.json" ]]; then
  cp -a "${REPO_SKILLS}/.cursor-plugin/plugin.json" "${HOME}/.cursor/plugins/pstack/.cursor-plugin/plugin.json"
fi

mkdir -p "${HOME}/.cursor/agents" "${HOME}/.claude/agents" "${HOME}/.agents/agents"
for agent in poteto-agent.md comment-sicko.md; do
  src="${ROOT}/.cursor/agents/${agent}"
  if [[ -f "${src}" ]]; then
    cp -a "${src}" "${HOME}/.cursor/agents/${agent}"
    cp -a "${src}" "${HOME}/.claude/agents/${agent}"
    cp -a "${src}" "${HOME}/.agents/agents/${agent}"
  fi
done

# Default model override rule if missing (setup-pstack can rewrite later).
RULE="${HOME}/.cursor/rules/pstack-models.mdc"
if [[ ! -f "${RULE}" ]]; then
  mkdir -p "${HOME}/.cursor/rules"
  if [[ -f "${ROOT}/.cursor/rules/pstack-models.mdc" ]]; then
    cp -a "${ROOT}/.cursor/rules/pstack-models.mdc" "${RULE}"
  fi
fi

test -f "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md"
test -f "${HOME}/.cursor/plugins/pstack/skills/poteto-mode/SKILL.md"
echo "ensure-pstack: ok poteto-mode=$(readlink -f "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md" 2>/dev/null || echo "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md")"
