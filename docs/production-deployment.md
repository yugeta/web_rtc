# 本番環境デプロイ

本番環境のデプロイ手順は [deployment.md](./deployment.md) に統合しました。

## 現在の本番構成

| コンポーネント | ホスト | 説明 |
|---|---|---|
| クライアント | `yugeta.github.io/web_rtc/` | GitHub Pages で配信。`main` ブランチ push 時に自動デプロイ |
| シグナリングサーバー | `sock.mynt.work` | VPS 上の Node.js + Socket.IO。Nginx リバースプロキシ経由 |
| STUN/TURN | `stun.mynt.work` | coturn。NAT越え用 |

## デプロイ方法

### クライアント（自動）

`main` ブランチに push すると GitHub Actions（`.github/workflows/deploy.yml`）が自動でビルド・デプロイします。

環境変数 `VITE_SERVER_URL=https://sock.mynt.work` は workflow 内で設定済みです。`VITE_GOOGLE_CLIENT_ID` も GitHub リポジトリの Secrets に追加し、workflow で設定してください。

### シグナリングサーバー（手動）

```bash
ssh ubuntu@<VPSのIPアドレス>
cd /var/www/web_rtc
git pull origin main
cd server
npm install
npm run build

# PM2使用時
pm2 restart webrtc-server

# systemd使用時
sudo systemctl restart web-rtc-signaling
```

詳細な手順（初回セットアップ、Nginx設定、SSL、systemd等）は [deployment.md](./deployment.md) を参照してください。

---

## サーバー作業ログ

### 2026-04-05: Google OAuth ログイン機能追加

Google OAuth 認証、JWT 認証、Room 管理 API、Dashboard 画面、react-router-dom によるルーティングを追加。

#### サーバー側の作業

```bash
ssh ubuntu@<VPSのIPアドレス>
cd /var/www/web_rtc
git pull origin main

# 依存パッケージ更新（google-auth-library, jsonwebtoken, uuid, dotenv を追加）
cd server
npm install

# 環境変数の設定（初回のみ）
cat >> .env << 'EOF'
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=<openssl rand -base64 32 で生成した値>
EOF

# ビルド・再起動
npm run build
pm2 restart webrtc-server
# または: sudo systemctl restart web-rtc-signaling
```

#### クライアント側の作業

GitHub Actions 自動デプロイの場合:
- リポジトリの Settings → Secrets and variables → Actions に `VITE_GOOGLE_CLIENT_ID` を追加
- workflow（`.github/workflows/deploy.yml`）で `VITE_GOOGLE_CLIENT_ID` を環境変数として渡すよう修正

手動ビルドの場合:
- `client/.env.production` に `VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com` を設定
- `npm run build` → VPS に転送
