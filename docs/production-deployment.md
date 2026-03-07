# 本番環境デプロイ

本番サーバーへのデプロイ手順を説明します。

## 前提条件

### サーバー要件

- **OS**: Ubuntu 20.04 LTS以上（推奨）
- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ストレージ**: 20GB以上
- **ネットワーク**: グローバルIPアドレス、ポート80/443が開放されている

### 必要なソフトウェア

- **Node.js**: v20以上
- **npm**: v10以上
- **Nginx**: 最新版（リバースプロキシ用）
- **PM2**: プロセス管理ツール
- **Certbot**: SSL証明書取得用

### ドメイン

- 独自ドメインまたはサブドメイン
- DNSレコードがサーバーのIPアドレスを指している

## デプロイ方法

### 方法1: 手動デプロイ（推奨）

#### 1. サーバーの初期設定

```bash
# サーバーにSSH接続
ssh user@your-server-ip

# システムのアップデート
sudo apt update && sudo apt upgrade -y

# 必要なパッケージのインストール
sudo apt install -y git curl nginx certbot python3-certbot-nginx
```

#### 2. Node.jsのインストール

```bash
# Node.js 20.xのインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# バージョン確認
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 3. PM2のインストール

```bash
# PM2をグローバルインストール
sudo npm install -g pm2

# PM2の自動起動設定
pm2 startup
# 表示されたコマンドを実行
```

#### 4. アプリケーションのデプロイ

```bash
# アプリケーション用ディレクトリを作成
sudo mkdir -p /var/www/webrtc-app
sudo chown -R $USER:$USER /var/www/webrtc-app

# リポジトリをクローン
cd /var/www/webrtc-app
git clone <repository-url> .

# サーバーのセットアップ
cd server
npm install --production

# クライアントのビルド
cd ../client
npm install
npm run build
```

#### 5. 環境変数の設定

##### サーバー環境変数

`/var/www/webrtc-app/server/.env` を作成:

```env
PORT=3001
NODE_ENV=production
```

##### クライアント環境変数

`/var/www/webrtc-app/client/.env.production` を作成:

```env
VITE_SERVER_URL=https://your-domain.com
```

クライアントを再ビルド:

```bash
cd /var/www/webrtc-app/client
npm run build
```

#### 6. PM2でサーバーを起動

```bash
cd /var/www/webrtc-app/server

# PM2でサーバーを起動
pm2 start src/index.ts --name webrtc-server --interpreter ts-node

# 自動起動設定を保存
pm2 save

# ステータス確認
pm2 status
pm2 logs webrtc-server
```

#### 7. Nginxの設定

`/etc/nginx/sites-available/webrtc-app` を作成:

```nginx
# HTTPからHTTPSへのリダイレクト
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS設定
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL証明書（Certbotが自動設定）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # クライアント（静的ファイル）
    location / {
        root /var/www/webrtc-app/client/dist;
        try_files $uri $uri/ /index.html;
        
        # キャッシュ設定
        add_header Cache-Control "public, max-age=31536000" always;
    }

    # Socket.IOサーバー（WebSocket対応）
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # タイムアウト設定
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # APIエンドポイント
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

設定を有効化:

```bash
# シンボリックリンクを作成
sudo ln -s /etc/nginx/sites-available/webrtc-app /etc/nginx/sites-enabled/

# デフォルト設定を無効化（オプション）
sudo rm /etc/nginx/sites-enabled/default

# 設定のテスト
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx
```

#### 8. SSL証明書の取得

```bash
# Certbotで証明書を取得
sudo certbot --nginx -d your-domain.com

# 自動更新のテスト
sudo certbot renew --dry-run
```

#### 9. ファイアウォールの設定

```bash
# UFWを有効化
sudo ufw enable

# 必要なポートを開放
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# ステータス確認
sudo ufw status
```

#### 10. 動作確認

```bash
# サーバーのログを確認
pm2 logs webrtc-server

# Nginxのログを確認
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# ブラウザでアクセス
# https://your-domain.com
```

### 方法2: Dockerを使用したデプロイ

#### 1. Dockerのインストール

```bash
# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# バージョン確認
docker --version
docker-compose --version
```

#### 2. 本番用Dockerfileの作成

##### サーバー用Dockerfile

`server/Dockerfile.prod` を作成:

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションのコピー
COPY . .

# TypeScriptのビルド
RUN npm install -g ts-node typescript
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

##### クライアント用Dockerfile

`client/Dockerfile.prod` を作成:

```dockerfile
FROM node:20-alpine as build
WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# ビルド
COPY . .
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build

# Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

##### Nginx設定

`client/nginx.conf` を作成:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # キャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. Docker Compose設定

`docker-compose.prod.yml` を作成:

```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: always
    networks:
      - webrtc-network

  client:
    build:
      context: ./client
      dockerfile: Dockerfile.prod
      args:
        VITE_SERVER_URL: https://your-domain.com
    ports:
      - "80:80"
    depends_on:
      - server
    restart: always
    networks:
      - webrtc-network

networks:
  webrtc-network:
    driver: bridge
```

#### 4. デプロイ実行

```bash
# リポジトリをクローン
cd /var/www/webrtc-app
git clone <repository-url> .

# Docker Composeでビルド・起動
docker-compose -f docker-compose.prod.yml up -d --build

# ログの確認
docker-compose -f docker-compose.prod.yml logs -f
```

## 更新とメンテナンス

### アプリケーションの更新

#### 手動デプロイの場合

```bash
cd /var/www/webrtc-app

# 最新のコードを取得
git pull origin main

# サーバーの更新
cd server
npm install --production
pm2 restart webrtc-server

# クライアントの更新
cd ../client
npm install
npm run build

# Nginxをリロード
sudo systemctl reload nginx
```

#### Dockerデプロイの場合

```bash
cd /var/www/webrtc-app

# 最新のコードを取得
git pull origin main

# 再ビルドして起動
docker-compose -f docker-compose.prod.yml up -d --build
```

### ログの確認

#### PM2のログ

```bash
# リアルタイムログ
pm2 logs webrtc-server

# ログファイルの場所
~/.pm2/logs/
```

#### Nginxのログ

```bash
# アクセスログ
sudo tail -f /var/log/nginx/access.log

# エラーログ
sudo tail -f /var/log/nginx/error.log
```

#### Dockerのログ

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### バックアップ

```bash
# アプリケーションのバックアップ
sudo tar -czf /backup/webrtc-app-$(date +%Y%m%d).tar.gz /var/www/webrtc-app

# データベースのバックアップ（将来的に必要な場合）
# mysqldump -u user -p database > backup.sql
```

## セキュリティ対策

### 1. ファイアウォール設定

```bash
# 不要なポートを閉じる
sudo ufw deny 3001/tcp  # Node.jsポートは直接アクセス不可に
```

### 2. Nginxのセキュリティ設定

`/etc/nginx/nginx.conf` に追加:

```nginx
# セキュリティヘッダー
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;

# サーバー情報を隠す
server_tokens off;
```

### 3. レート制限

Nginxでレート制限を設定:

```nginx
# /etc/nginx/nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    
    # ...
}

# サーバーブロック内
location /socket.io/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ...
}
```

### 4. CORS設定

サーバー側で適切なCORS設定:

```typescript
// server/src/index.ts
const io = new Server(server, {
  cors: {
    origin: 'https://your-domain.com',  // 本番ドメインのみ許可
    methods: ['GET', 'POST']
  }
});
```

## モニタリング

### PM2モニタリング

```bash
# リアルタイムモニタリング
pm2 monit

# ステータス確認
pm2 status

# メモリ使用量
pm2 list
```

### システムリソース

```bash
# CPU/メモリ使用量
htop

# ディスク使用量
df -h

# ネットワーク接続
netstat -tulpn
```

## トラブルシューティング

### サーバーが起動しない

```bash
# PM2のログを確認
pm2 logs webrtc-server --lines 100

# ポートが使用中か確認
sudo lsof -i :3001

# プロセスを再起動
pm2 restart webrtc-server
```

### SSL証明書のエラー

```bash
# 証明書の更新
sudo certbot renew

# Nginxを再起動
sudo systemctl restart nginx
```

### WebSocketが接続できない

1. Nginxの設定を確認（Upgrade/Connectionヘッダー）
2. ファイアウォールの設定を確認
3. ブラウザのコンソールでエラーを確認

## パフォーマンス最適化

### 1. Nginxのキャッシュ設定

```nginx
# 静的ファイルのキャッシュ
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 2. Gzip圧縮

```nginx
# /etc/nginx/nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### 3. PM2クラスターモード

```bash
# 複数プロセスで起動（CPUコア数に応じて）
pm2 start src/index.ts --name webrtc-server -i 2 --interpreter ts-node
```

## 次のステップ

- [トラブルシューティング](./troubleshooting.md)を確認
- モニタリングツールの導入（Prometheus、Grafana等）
- CDNの導入（CloudFlare、AWS CloudFront等）
- TURN/STUNサーバーの設定（NAT越え対策）
