#!/bin/bash
# ============================================================
# BuildVideo 一键部署脚本
# 用法: bash scripts/deploy.sh [commit message]
# ============================================================
set -e

SERVER="ubuntu@43.153.123.138"
SERVER_DIR="/home/ubuntu/waoowaoo"
SERVER_PASS='93uLIHuy#oAQkq%a'

echo "=========================================="
echo "  BuildVideo 部署"
echo "=========================================="

# 1. 检查是否有未提交的改动
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "[1/4] 检测到未提交的改动，正在提交..."
  git add -A
  MSG="${1:-auto: deploy update}"
  git commit -m "$MSG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
else
  echo ""
  echo "[1/4] 无新改动，跳过提交"
fi

# 2. Push 到 origin
echo ""
echo "[2/4] 推送到 origin/main..."
git push origin main

# 3. 服务器同步 + 构建
echo ""
echo "[3/4] 服务器同步代码 + Docker 重建..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" \
  "cd $SERVER_DIR && git fetch private main && git reset --hard private/main && docker compose up -d --build app" 2>&1

# 4. 验证
echo ""
echo "[4/4] 验证容器状态..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" \
  "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep buildvideo"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "  https://buildvideo.ai"
echo "=========================================="
