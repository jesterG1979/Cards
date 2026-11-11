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

# User skill store is shared across this account's Cloud Agents, including
# agents on other repositories. Install each skill as its own directory so
# discovery finds SKILL.md the same way it finds other user skills.
USER_STORE="/cursor/stores/user"
if [[ -d "${USER_STORE}" ]]; then
  USER_SKILLS="${USER_STORE}/skills"
  mkdir -p "${USER_SKILLS}" "${USER_STORE}/pstack"
  # This store rejects chmod (cp fails with EPERM while setting permissions).
  copy_tree() {
    python3 - "$1" "$2" <<'PY'
import os, shutil, sys
src, dst = sys.argv[1], sys.argv[2]
def copy(s, d):
    if os.path.isdir(s) and not os.path.islink(s):
        os.makedirs(d, exist_ok=True)
        for name in os.listdir(s):
            copy(os.path.join(s, name), os.path.join(d, name))
    else:
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(s, d, follow_symlinks=True)
copy(src, dst)
PY
  }
  if [[ -f "${REPO_SKILLS}/LICENSE" ]]; then
    copy_tree "${REPO_SKILLS}/LICENSE" "${USER_STORE}/pstack/LICENSE"
  fi
  if [[ -f "${REPO_SKILLS}/SOURCE.md" ]]; then
    copy_tree "${REPO_SKILLS}/SOURCE.md" "${USER_STORE}/pstack/SOURCE.md"
  fi
  if [[ -f "${REPO_SKILLS}/.cursor-plugin/plugin.json" ]]; then
    copy_tree "${REPO_SKILLS}/.cursor-plugin/plugin.json" "${USER_STORE}/pstack/plugin.json"
  fi
  for skill_dir in "${REPO_SKILLS}"/*/; do
    [[ -f "${skill_dir}SKILL.md" ]] || continue
    name="$(basename "${skill_dir}")"
    rm -rf "${USER_SKILLS}/${name}"
    copy_tree "${skill_dir}" "${USER_SKILLS}/${name}"
  done
  test -f "${USER_SKILLS}/poteto-mode/SKILL.md"
fi

test -f "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md"
test -f "${HOME}/.cursor/plugins/pstack/skills/poteto-mode/SKILL.md"
echo "ensure-pstack: ok poteto-mode=$(readlink -f "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md" 2>/dev/null || echo "${HOME}/.cursor/skills/pstack/poteto-mode/SKILL.md")"
