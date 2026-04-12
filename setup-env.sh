#!/bin/bash
# ============================================
# .env セットアップスクリプト
# 対話式で値を入力し、3つの .env ファイルを生成します
# ============================================

set -e

echo ""
echo "🔧 環境変数セットアップ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 既存ファイルチェック
EXISTING_FILES=""
[ -f .env ] && EXISTING_FILES="$EXISTING_FILES .env"
[ -f client/.env ] && EXISTING_FILES="$EXISTING_FILES client/.env"
[ -f server/.env ] && EXISTING_FILES="$EXISTING_FILES server/.env"

if [ -n "$EXISTING_FILES" ]; then
  echo "⚠️  以下の .env ファイルが既に存在します:"
  for f in $EXISTING_FILES; do
    echo "   - $f"
  done
  echo ""
  read -p "上書きしますか？ [y/N]: " OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[yY]$ ]]; then
    echo "中止しました。"
    exit 0
  fi
  echo ""
fi

# --- Google Client ID ---
echo "📌 Google OAuth Client ID"
echo "   Google Cloud Console で取得してください"
echo "   https://console.cloud.google.com/"
echo ""
read -p "   Client ID: " GOOGLE_CLIENT_ID

if [ -z "$GOOGLE_CLIENT_ID" ]; then
  echo "❌ Client ID は必須です。"
  exit 1
fi

# --- JWT Secret ---
echo ""
echo "🔑 JWT Secret"
read -p "   自動生成しますか？ [Y/n]: " AUTO_JWT

if [[ "$AUTO_JWT" =~ ^[nN]$ ]]; then
  read -p "   JWT Secret: " JWT_SECRET
  if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT Secret は必須です。"
    exit 1
  fi
else
  JWT_SECRET=$(openssl rand -base64 32)
  echo "   生成しました: ${JWT_SECRET:0:8}..."
fi

# --- Admin User IDs ---
echo ""
echo "👤 管理者ユーザー ID（任意）"
echo "   初回ログイン後に server/data/users.json で確認できます"
echo "   複数指定はカンマ区切り（空欄でスキップ可）"
read -p "   Admin User IDs: " ADMIN_USER_IDS

# --- VAPID Keys ---
echo ""
echo "🔔 プッシュ通知 VAPID 鍵（任意）"
read -p "   VAPID 鍵を設定しますか？ [y/N]: " SETUP_VAPID

VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT=""

if [[ "$SETUP_VAPID" =~ ^[yY]$ ]]; then
  read -p "   VAPID Public Key: " VAPID_PUBLIC_KEY
  read -p "   VAPID Private Key: " VAPID_PRIVATE_KEY
  read -p "   VAPID Subject (mailto:...): " VAPID_SUBJECT
fi

# --- ポート ---
echo ""
read -p "🌐 サーバーポート [3001]: " PORT
PORT=${PORT:-3001}

# ============================================
# ファイル生成
# ============================================

# ルート .env
cat > .env << EOF
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
JWT_SECRET=${JWT_SECRET}
ADMIN_USER_IDS=${ADMIN_USER_IDS}
EOF

# client/.env
cat > client/.env << EOF
VITE_SERVER_URL=http://localhost:${PORT}
VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
EOF

if [ -n "$VAPID_PUBLIC_KEY" ]; then
  echo "VITE_VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}" >> client/.env
fi

# server/.env
cat > server/.env << EOF
PORT=${PORT}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
JWT_SECRET=${JWT_SECRET}
ADMIN_USER_IDS=${ADMIN_USER_IDS}
EOF

if [ -n "$VAPID_PUBLIC_KEY" ]; then
  cat >> server/.env << EOF
VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_SUBJECT=${VAPID_SUBJECT}
EOF
fi

# ============================================
# 完了
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 以下のファイルを生成しました:"
echo "   - .env"
echo "   - client/.env"
echo "   - server/.env"
echo ""
echo "🚀 起動方法:"
echo "   Docker:  docker-compose up"
echo "   直接:    cd server && npm run dev  /  cd client && npm run dev"
echo ""
