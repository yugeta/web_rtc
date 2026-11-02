# Docker 構成パターン比較

このドキュメントでは、`sock.mynt.work` を公開する際の構成を、次の 2 パターンで整理する。

- パターン A: Nginx Proxy Manager (NPM) を公開入口として使う
- パターン B: WebRTC 専用 nginx を別コンテナで立てる

## まとめ

現時点の本番構成としては、パターン A を推奨する。

理由:
- 入口が 1 つで管理しやすい
- NPM が TLS 終端とドメイン管理を担当できる
- `sock` の Node.js サーバーは内部ネットワークに閉じられ、公開層とバックエンド層を分離できる
- 設定の複雑さが少なく、運用ミスが起きにくい

パターン B は、特別な理由がある場合にだけ使う方がよい。

- 公開入口と専用バックエンドが分離される
- ただし構成が二重化し、ポート競合やルーティングの混乱が起きやすい
- `80 / 443` のどちらが最終的に受けるかを意識しないと、CORS や TLS の問題が起きやすい

---

## パターン A: NPM を公開入口にする（推奨）

### 構成イメージ

```text
Browser
  └─ https://sock.mynt.work
        └─ NPM (app)
              └─ proxy_pass -> http://sock:3001
                            └─ Node.js / Express / Socket.IO
```

### 役割分担

- `app`: NPM
  - 80 / 443 の公開入口
  - TLS 終端
  - ドメイン管理
  - Proxy Host 設定

- `sock`: WebRTC / API サーバー
  - Node.js アプリ本体
  - 3001 で内部 service として動く
  - public port は基本的に不要

### 例: Docker Compose のイメージ

```yaml
version: '3.8'

networks:
  web_network:
    external: true

services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - /share/Web/container_station/data:/data
      - /share/Web/container_station/letsencrypt:/etc/letsencrypt
    networks:
      - web_network

  sock:
    build:
      context: /share/Web/web_rtc.mynt.work/server
      dockerfile: Dockerfile
    container_name: webrtc-sock
    restart: unless-stopped
    env_file:
      - /share/Web/web_rtc.mynt.work/docker/.env
    environment:
      PORT: '3001'
    networks:
      - web_network
```

### NPM 側での Proxy 設定イメージ

- Domain: `sock.mynt.work`
- Scheme: `http`
- Forward host: `sock:3001`
- もしくは `webrtc-sock:3001` など、Docker のサービス名を使う

### メリット

- 設定が最もシンプル
- TLS とドメインの管理が集中する
- `web_server` などの二重構成を避けられる
- バックエンドの公開範囲を狭く保てる

### デメリット

- `app` が NPM なので、あくまで「公開入口」になる
- 逆プロキシのルールが増えると、NPM 側の設定の肥大化が起きる

### 向いているケース

- 通常の本番運用
- WebRTC で `sock.mynt.work` を 1 ドメインで使う
- TLS 管理と公開層を NPM に集約したい

---

## パターン B: WebRTC 専用 nginx を別コンテナで立てる

### 構成イメージ

```text
Browser
  └─ https://sock.mynt.work
        └─ web_server (専用 nginx)
              └─ proxy_pass -> http://sock:3001
                            └─ Node.js / Express / Socket.IO
```

### 役割分担

- `app`: NPM など、別の用途 or 管理用の nginx
- `web_server`: WebRTC 専用の nginx
  - `sock.mynt.work` を受ける
  - `sock:3001` に転送する

- `sock`: Node.js サーバー

### 例: Docker Compose のイメージ

```yaml
version: '3.8'

networks:
  web_network:
    external: true

services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    networks:
      - web_network

  web_server:
    image: nginx:alpine
    container_name: web_server
    restart: unless-stopped
    volumes:
      - /share/Web:/share/Web
      - /share/Web/container_station/nginx/conf.d:/etc/nginx/conf.d:ro
      - /share/Web/container_station/letsencrypt:/etc/letsencrypt:ro
    networks:
      - web_network

  sock:
    build:
      context: /share/Web/web_rtc.mynt.work/server
      dockerfile: Dockerfile
    container_name: webrtc-sock
    restart: unless-stopped
    networks:
      - web_network
```

### 典型的な nginx 設定

```nginx
server {
    listen 80;
    server_name sock.mynt.work;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sock.mynt.work;

    ssl_certificate /etc/letsencrypt/live/sock.mynt.work/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sock.mynt.work/privkey.pem;

    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000 always;
            return 204;
        }

        proxy_pass http://sock:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### メリット

- NPM の公開入口と WebRTC 専用 nginx を切り分けられる
- 特定ドメインだけを独自に制御したい場合に扱いやすい
- WebRTC 特有のルーティング調整がしやすい

### デメリット

- 入口が 2 つになりやすく、どこが最終公開入口かが曖昧になる
- TLS やドメインの設定が複数箇所に散りやすい
- 80 / 443 のリダイレクトと preflight の 204 応答の両方を個別に管理する必要がある
- 運用時のミスが多くなりやすい

### 向いているケース

- 独自のプロキシ・ルーティング要件がある
- 多数のバックエンドを分離したい
- WebRTC 用だけに最適化した nginx を独立して運用したい

---

## 選択の判断基準

### パターン A を選ぶべきとき

- 1 ドメイン 1 入口で運用したい
- TLS と公開設定を一元化したい
- サービス数が少なく、構成を簡潔に保ちたい
- すでに NPM を使っている

### パターン B を選ぶべきとき

- 独自の nginx 設定が必要
- WebRTC 用だけに特別な reverse proxy を入れたい
- 既存システムと NPM の責務を切り分けたい

---

## 実運用での推奨

当プロジェクトでは、現状の設計としてはパターン A を推奨する。

理由:
- `sock.mynt.work` は公開入口としての役割が明確
- `sock` の Node.js サーバーは内部ネットワークに閉じることができる
- NPM はドメイン・TLS・証明書とプロキシの入口を担当し、構成がわかりやすい
- `web_server` を追加すると、CORS / preflight / redirect の管理が複雑になる

### 推奨構成

```text
sock.mynt.work
  -> NPM (app)
  -> proxy_pass to http://sock:3001
```

### 非推奨構成

```text
sock.mynt.work
  -> web_server
  -> app
  -> sock
```

※ `web_server` を追加して NPM と二重化すると、公開入口とルーティングが曖昧になりやすい。

---

## 結論

- パターン A: シンプルで安定、推奨
- パターン B: 特別な要求がある場合のみ採用

現時点の本プロジェクトでは、パターン A を基準に据えて運用することを推奨する。
