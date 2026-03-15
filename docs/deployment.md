# VPS 本番デプロイ手順書（Ubuntu 24.04 LTS / メモリ1GB）

Ubuntu 24.04 LTS インストール直後の状態から、シグナリングサーバーとクライアントを本番稼働させるまでの手順です。

## 対象環境

| 項目 | 値 |
|------|-----|
| OS | Ubuntu 24.04 LTS |
| CPU | 1vCPU以上 |
| メモリ | 1GB（最小構成を想定） |
| SSD | 20GB以上 |
| IP | グローバルIPv4 |

> **メモリ1GBの制約**: クライアントのビルド（`npm run build`）はメモリ不足になる可能性が高いため、ローカルPCでビルドしてサーバーに転送します。

---

## 1. SSH接続と環境確認

```bash
ssh ubuntu@<VPSのIPアドレス>
```

### 1.1 OS・カーネルの確認

```bash
cat /etc/os-release
uname -r
```

### 1.2 事前インストール済みパッケージの確認

```bash
# 主要コマンドの有無を確認
which git curl wget nginx node npm pm2 certbot

# インストール済みパッケージ一覧（必要に応じて）
dpkg -l | wc -l
```

Ubuntu 24.04 LTS最小構成では `git`, `curl`, `wget` 程度のみ。`nginx`, `node`, `pm2`, `certbot` は未インストール。

### 1.3 ディスク・メモリ・swapの確認

```bash
df -h
free -h
swapon --show
```

### 1.4 ファイアウォール状態の確認

```bash
sudo ufw status
```

---

## 2. システムの初期設定

### 2.1 パッケージの更新

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 swapの作成（メモリ1GBの場合は必須）

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

- エラー（すでにswapが使われている）の場合（メモリを再構築する手順）
> fallocate: fallocate failed: Text file busy
sudo swapoff /swapfile
sudo rm /swapfile
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永続化
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# swappiness調整
echo 'vm.swappiness=60' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 確認
free -h
```

> メモリに余裕がある環境（2GB以上）ではswap作成は任意。

### 2.3 必要パッケージのインストール

```bash
sudo apt install -y git curl nginx certbot python3-certbot-nginx
```

---

## 3. Node.jsのインストール

```bash
- Node公式リポジトリを使う方法。
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

- またはnpmを使う方法。
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

sudo apt install -y nodejs

# 確認
node --version   # v20.x.x
npm --version    # 10.x.x

- 既存のバージョンが古い場合は、上記コマンドでバージョンが上書きされる。

## Ubuntu18でのインストール手順
- Node20互換ビルドを取得
wget https://unofficial-builds.nodejs.org/download/release/v20.11.1/node-v20.11.1-linux-x64-glibc-217.tar.xz
tar xf node-v20.11.1-linux-x64-glibc-217.tar.xz
mv node-v20.11.1-linux-x64-glibc-217 /usr/local/node20
echo 'export PATH=/usr/local/node20/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

```

---

## 4. PM2のインストール

```bash
sudo npm install -g pm2

# OS起動時の自動起動設定
pm2 startup
# 表示されたsudoコマンドをコピーして実行する
```

---

## 5. アプリケーションのデプロイ

### 5.1 ディレクトリ作成

```bash
sudo mkdir -p /var/www/webrtc-app
sudo chown -R $USER:$USER /var/www/webrtc-app
```

### 5.2 サーバーのデプロイ

```bash
cd /var/www/webrtc-app
git clone <リポジトリURL> .

cd server
npm install --production
npm install ts-node typescript
```

### 5.3 サーバー環境変数の設定

```bash
# cat > /var/www/webrtc-app/server/.env << 'EOF'
cat > ./.env << 'EOF'
PORT=3001
NODE_ENV=production
EOF
```

### 5.4 クライアントのビルドと転送（ローカルPCで実行）

```bash
# --- ローカルPCで実行 ---
cd client

# 本番用の環境変数を設定
echo 'VITE_SERVER_URL=https://your-domain.com' > .env.production

npm install
npm run build

# ビルド成果物をサーバーに転送
scp -r dist/ ubuntu@<VPSのIPアドレス>:/var/www/webrtc-app/client/dist/
```

> メモリ2GB以上の環境であればサーバー上で直接 `npm run build` も可能。

---

## 6. PM2でサーバーを起動

```bash
cd /var/www/webrtc-app/server

pm2 start src/index.ts \
  --name webrtc-server \
  --interpreter ./node_modules/.bin/ts-node \
  --max-memory-restart 400M

# 確認
pm2 status
pm2 logs webrtc-server --lines 20

# 自動起動設定を保存
pm2 save
```

---

## 7. Nginxの設定

### 7.1 SSL取得用の一時設定

SSL証明書取得前に、まずHTTPのみで起動します。

```bash
sudo tee /etc/nginx/sites-available/webrtc-app << 'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        root /var/www/webrtc-app/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/webrtc-app /etc/nginx/sites-enabled/webrtc-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7.2 SSL証明書の取得

```bash
sudo certbot --nginx -d your-domain.com

# 自動更新テスト
sudo certbot renew --dry-run
```

### 7.3 本番用Nginx設定に切り替え

```bash
sudo tee /etc/nginx/sites-available/webrtc-app << 'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    server_tokens off;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    # クライアント（静的ファイル）
    location / {
        root /var/www/webrtc-app/client/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Socket.IO（WebSocket対応）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
NGINX

sudo nginx -t
sudo systemctl restart nginx
```

---

## 8. ファイアウォールの設定

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

ポート3001は外部に開放しない（Nginx経由でアクセスする）。

---

## 9. 動作確認

```bash
# PM2ステータス
pm2 status

# ヘルスチェック
curl -s http://localhost:3001/
# → "Signaling Server is running"

# メモリ使用量
free -h
pm2 monit

# Nginxエラーログ
sudo tail -f /var/log/nginx/error.log
```

ブラウザで `https://your-domain.com` にアクセスして動作確認。

---

## 10. アプリケーションの更新手順

### サーバー側

```bash
cd /var/www/webrtc-app
git pull origin main
cd server
npm install --production
pm2 restart webrtc-server
```

### クライアント側（ローカルPCで実行）

```bash
cd client
npm run build
scp -r dist/ ubuntu@<VPSのIPアドレス>:/var/www/webrtc-app/client/dist/
```

---

## メモリ1GB運用時の注意事項

- swapは必ず設定する（OOM Killerによるプロセス強制終了を防ぐ）
- PM2の `--max-memory-restart` でNode.jsプロセスのメモリ上限を設定する
- クライアントのビルドはローカルPCで行い、`scp` で転送する
- 同時接続ユーザー数は3〜4人程度が目安（P2P接続のためサーバー負荷はシグナリングのみ）
- `pm2 monit` で定期的にメモリ使用量を確認する
