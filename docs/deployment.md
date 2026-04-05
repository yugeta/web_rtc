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
| シグナリングサーバー | `sock.mynt.work` |
| クライアント配信 | GitHub Pages (`yugeta.github.io/web_rtc/`) |
| STUN/TURNサーバー | `stun.mynt.work` |

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
which git curl wget nginx node npm pm2 certbot
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
```

エラー（すでにswapが使われている）の場合:

```bash
sudo swapoff /swapfile
sudo rm /swapfile
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

永続化:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=60' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
free -h
```

> メモリに余裕がある環境（2GB以上）ではswap作成は任意。

### 2.3 必要パッケージのインストール

```bash
sudo apt install -y git curl nginx certbot python3-certbot-nginx
```

---

## 3. Node.jsのインストール

Node公式リポジトリを使う方法:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

またはnvmを使う方法:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

確認:

```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

### Ubuntu 18でのインストール手順

```bash
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
sudo mkdir -p /var/www/web_rtc
sudo chown -R $USER:$USER /var/www/web_rtc
```

### 5.2 サーバーのデプロイ

```bash
cd /var/www/web_rtc
git clone <リポジトリURL> .

cd server
npm install --production
npm install ts-node typescript
```

### 5.3 サーバー環境変数の設定

```bash
cd /var/www/web_rtc/server
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
EOF
```

### 5.4 クライアントのビルドと転送（ローカルPCで実行）

本プロジェクトではクライアントは GitHub Pages で配信しているため、GitHub Actions（`.github/workflows/deploy.yml`）が `main` ブランチへの push 時に自動ビルド・デプロイします。

手動でVPSに配置する場合:

```bash
# --- ローカルPCで実行 ---
cd client
echo 'VITE_SERVER_URL=https://sock.mynt.work' > .env.production
npm install
npm run build

# ビルド成果物をサーバーに転送
scp -r dist/ ubuntu@<VPSのIPアドレス>:/var/www/web_rtc/client/dist/
```

> メモリ2GB以上の環境であればサーバー上で直接 `npm run build` も可能。

---

## 6. サーバーの起動と自動起動

### 6.1 PM2で起動する場合

```bash
cd /var/www/web_rtc/server

pm2 start src/index.ts \
  --name webrtc-server \
  --interpreter ./node_modules/.bin/ts-node \
  --max-memory-restart 400M

pm2 status
pm2 logs webrtc-server --lines 20

# 自動起動設定を保存
pm2 save
```

### 6.2 systemdで起動する場合（PM2の代替）

```bash
sudo tee /etc/systemd/system/web-rtc-signaling.service << 'EOF'
[Unit]
Description=WebRTC Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/web_rtc/server
ExecStart=/usr/bin/npx ts-node src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF
```

> `ExecStart` のパスは `which npx` の結果に合わせてください。nvm 使用時はフルパスが必要です（例: `/home/username/.nvm/versions/node/v20.x.x/bin/npx`）。

```bash
sudo systemctl daemon-reload
sudo systemctl enable web-rtc-signaling
sudo systemctl start web-rtc-signaling
sudo systemctl status web-rtc-signaling

# ログ確認
sudo journalctl -u web-rtc-signaling -f
```

---

## 7. Nginxの設定

### 7.1 シグナリングサーバー用（sock.mynt.work）

`sock.mynt.work` は Socket.IO サーバーへのリバースプロキシとして設定します。

```bash
sudo tee /etc/nginx/sites-available/sock.mynt.work << 'NGINX'
server {
    server_name sock.mynt.work;

    # dot files を拒否
    location ~ /\.git { deny all; return 404; }
    location ~ /\..*$ { deny all; return 404; }

    # Socket.IO + HTTPリクエストをNode.jsにプロキシ
    location / {
        # CORS preflight (OPTIONS) 対応
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket対応
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Socket.IOのlong-polling対応
        proxy_read_timeout 86400;

        # プロキシ先のCORSヘッダーをそのまま通す
        proxy_pass_header Access-Control-Allow-Origin;
        proxy_pass_header Access-Control-Allow-Methods;
        proxy_pass_header Access-Control-Allow-Headers;
        proxy_pass_header Access-Control-Allow-Credentials;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/sock.mynt.work/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sock.mynt.work/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name sock.mynt.work;
    return 301 https://$host$request_uri;
}
NGINX

sudo ln -sf /etc/nginx/sites-available/sock.mynt.work /etc/nginx/sites-enabled/sock.mynt.work
sudo nginx -t
sudo systemctl restart nginx
```

### 7.2 SSL証明書の取得（新規の場合）

```bash
sudo certbot --nginx -d sock.mynt.work
sudo certbot renew --dry-run
```

### 7.3 クライアントをVPSで配信する場合（GitHub Pages不使用時）

```bash
sudo tee /etc/nginx/sites-available/webrtc-client << 'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
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

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    location / {
        root /var/www/web_rtc/client/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX
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
# PM2使用時
pm2 status

# systemd使用時
sudo systemctl status web-rtc-signaling

# ヘルスチェック
curl -s http://localhost:3001/
# → "Signaling Server is running"

# メモリ使用量
free -h

# Nginxエラーログ
sudo tail -f /var/log/nginx/error.log
```

ブラウザで `https://yugeta.github.io/web_rtc/` にアクセスして動作確認。

---

## 10. アプリケーションの更新手順

### サーバー側

```bash
cd /var/www/web_rtc
git pull origin main
cd server
npm install --production

# PM2使用時
pm2 restart webrtc-server

# systemd使用時
sudo systemctl restart web-rtc-signaling
```

### クライアント側

GitHub Pages 使用時は `main` ブランチに push すれば GitHub Actions が自動デプロイします。

VPSに手動配置する場合:

```bash
# ローカルPCで実行
cd client
npm run build
scp -r dist/ ubuntu@<VPSのIPアドレス>:/var/www/web_rtc/client/dist/
```

---

## メモリ1GB運用時の注意事項

- swapは必ず設定する（OOM Killerによるプロセス強制終了を防ぐ）
- PM2の `--max-memory-restart` でNode.jsプロセスのメモリ上限を設定する
- クライアントのビルドはローカルPCで行い、`scp` で転送する
- 同時接続ユーザー数は3〜4人程度が目安（P2P接続のためサーバー負荷はシグナリングのみ）
- `pm2 monit` で定期的にメモリ使用量を確認する
