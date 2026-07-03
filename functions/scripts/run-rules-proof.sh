#!/usr/bin/env bash
# 安全規則「前 vs 後」對照證明。
# 用同一份攻擊腳本（rules-proof.cjs）分別跑現況 main 的規則與本分支的加固規則，
# 證明：現況規則下攻擊全成功，加固規則下攻擊全被擋、正常流程仍放行。
#
# 用法（從專案根目錄）：bash functions/scripts/run-rules-proof.sh
set -uo pipefail
cd "$(dirname "$0")/../.." # 專案根目錄
ROOT="$(pwd)"
TMP="$(mktemp -d)"
MAIN_REF="${1:-main}"

echo "==================================================================="
echo " A) 現況（$MAIN_REF 的 firestore.rules）—— 預期攻擊會成功 ❌"
echo "==================================================================="
git show "$MAIN_REF:firestore.rules" > "$TMP/old.firestore.rules"
cat > "$TMP/firebase.old.json" <<EOF
{ "firestore": { "rules": "$TMP/old.firestore.rules" },
  "emulators": { "auth": { "port": 9099 }, "firestore": { "port": 8080 } } }
EOF
firebase emulators:exec --only firestore,auth --config "$TMP/firebase.old.json" --project mission-for-kids \
  'node functions/scripts/rules-proof.cjs' 2>/dev/null | grep -E "✅|❌|結果|===="

echo ""
echo "==================================================================="
echo " B) 加固後（本分支的 firestore.rules）—— 預期攻擊全被擋 ✅"
echo "==================================================================="
firebase emulators:exec --only firestore,auth --project mission-for-kids \
  'node functions/scripts/rules-proof.cjs' 2>/dev/null | grep -E "✅|❌|結果|===="

rm -rf "$TMP"
