# ローカル開発環境構築

## 前提条件

| ソフトウェア | バージョン | 必須 |
|---|---|---|
| Node.js | v20以上 | ○（方法2の場合） |
| npm | v10以上（Node.js同梱） | ○（方法2の場合） |
| Docker | v20以上 | ○（方法1の場合） |
| Docker Compose | v2以上 | ○（方法1の場合） |
| Git | 最新版 | ○ |

---

## 方法1: Docker Compose で起動

Docker がインストールされていれば、コマンド1つで起動できます。

### 起動

```bash
git clone <repository-url>
cd <project-directory>
docker-compose up
```

起動後のアクセス先:

| サービス | URL |
|---|---|
| クライアント | http://localhost:5173 |
| シグナリングサーバー | http://localhost:3001 |

### Docker Compose の主なコマンド

| やりたいこと | コマンド |
|---|---|
| 起動（フォアグラウンド） | `docker-compose up` |
| 起動（バックグラウンド） | `docker-compose up -d` |
| ログ確認 | `docker-compose logs -f` |
| 停止 | `docker-compose down` |
| 再ビルドして起動 | `docker-compose up --build` |
| コンテナ・ボリューム削除して再構築 | `docker-compose down -v && docker-compose build --no-cache && docker-compose up` |

### Docker 構成の詳細

`docker-compose.yml` で以下の2つのサービスが起動します:

```
client (Node 20 Alpine)
├── ポート: 5173
├── ソースコード: ./client をマウント（ホットリロード対応）
├── 環境変数: VITE_SERVER_URL=http://localhost:3001
└── コマンド: npm run dev

server (Node 20 Alpine)
├── ポート: 3001
├── ソースコード: ./server をマウント（ホットリロード対応）
├── 環境変数: PORT=3001
└── コマンド: npm run dev
```

ソースコードはボリュームマウントされているので、ファイルを編集すると自動で反映されます（クライアントは Vite HMR、サーバーは nodemon）。

---

## 方法2: Node.js で直接起動

Docker を使わず、Node.js で直接起動する方法です。ターミナルを2つ使います。

### ターミナル1: サーバー

```bash
cd server
npm install
npm run dev
# → http://localhost:3001 で起動
```

### ターミナル2: クライアント

```bash
cd client
npm install
npm run dev
# → http://localhost:5173 で起動
```

---

## 環境変数

認証機能（Google OAuth）を動作させるには `.env` ファイルの作成が必須です。サーバーは `GOOGLE_CLIENT_ID` と `JWT_SECRET` が未設定だと起動時にエラーで終了します。

### 一覧

| 変数 | 設定先 | 必須 | 説明 |
|---|---|---|---|
| `VITE_SERVER_URL` | `client/.env` | △ | シグナリングサーバーの URL（デフォルト: `http://localhost:3001`） |
| `VITE_GOOGLE_CLIENT_ID` | `client/.env` | ○ | Google OAuth Client ID |
| `PORT` | `server/.env` | △ | サーバーのリッスンポート（デフォルト: `3001`） |
| `GOOGLE_CLIENT_ID` | `server/.env` | ○ | Google OAuth Client ID（トークン検証用） |
| `JWT_SECRET` | `server/.env` | ○ | JWT 署名用シークレット |
| `ADMIN_USER_IDS` | `server/.env` | △ | 管理者の Google ユーザー ID（カンマ区切りで複数指定可） |

### Google OAuth Client ID の取得

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「認証情報」→「OAuth 2.0 クライアント ID」を作成
   - アプリケーションの種類: ウェブ アプリケーション
3. 「承認済みの JavaScript 生成元」に以下を追加:
   - 開発用: `http://localhost:5173`
   - 本番用: `https://yugeta.github.io`（GitHub Pages の場合）
4. 作成後に表示される Client ID（`xxx.apps.googleusercontent.com` 形式）をコピー

### .env ファイルの作成手順

すべての方法共通で、まず `.env.example` をコピーして値を埋めます。

```bash
# ルート
cp .env.example .env

# クライアント
cp client/.env.example client/.env

# サーバー
cp server/.env.example server/.env
```

各ファイルを開いて、取得した `GOOGLE_CLIENT_ID` や生成した `JWT_SECRET` を設定してください。

#### 方法1: Docker Compose の場合

3 つのファイルを作成します。

```bash
# 1. プロジェクトルート/.env（docker-compose.yml が読み込む）
cat > .env << 'EOF'
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=your-random-secret-string-here
ADMIN_USER_IDS=your-google-sub-id
EOF

# 2. client/.env
cat > client/.env << 'EOF'
VITE_SERVER_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
EOF

# 3. server/.env（Docker Compose 経由で渡されるため通常は不要だが、直接起動時の保険として）
cat > server/.env << 'EOF'
PORT=3001
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=your-random-secret-string-here
ADMIN_USER_IDS=your-google-sub-id
EOF
```

`docker-compose.yml` は `${GOOGLE_CLIENT_ID}` / `${JWT_SECRET}` / `${ADMIN_USER_IDS}` をルートの `.env` から読み込んでサーバーコンテナに渡します。

#### 方法2: Node.js 直接起動の場合

2 つのファイルを作成します。

```bash
# 1. server/.env
cat > server/.env << 'EOF'
PORT=3001
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=your-random-secret-string-here
ADMIN_USER_IDS=your-google-sub-id
EOF

# 2. client/.env
cat > client/.env << 'EOF'
VITE_SERVER_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
EOF
```

#### JWT_SECRET の生成

十分に長いランダム文字列を使用してください。以下のコマンドで生成できます:

```bash
openssl rand -base64 32
```

### ADMIN_USER_IDS の確認方法

管理者にしたいユーザーの Google ユーザー ID（`sub`）を指定します。初回ログイン後に `server/data/users.json` を確認すると `sub` フィールドに記載されています。複数人指定する場合はカンマ区切り:

```
ADMIN_USER_IDS=sub1,sub2
```

### 本番環境の .env

#### VPS（サーバー側）

```bash
# /var/www/web_rtc/server/.env
PORT=3001
NODE_ENV=production
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=your-production-secret
ADMIN_USER_IDS=your-google-sub-id
```

#### GitHub Pages（クライアント側）

`client/.env.production` は既にリポジトリに含まれています:

```
VITE_SERVER_URL=https://sock.mynt.work
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

GitHub Actions でビルドする場合は、リポジトリの Settings → Secrets and variables → Actions に `VITE_GOOGLE_CLIENT_ID` を追加し、workflow で `.env.production` に書き出すか、ビルドコマンドの環境変数として渡してください。

### 注意事項

- `.env` ファイルは `.gitignore` に含まれているため、リポジトリにはコミットされません
- `GOOGLE_CLIENT_ID` と `VITE_GOOGLE_CLIENT_ID` の値は同じ Client ID です
- サーバーは `GOOGLE_CLIENT_ID` または `JWT_SECRET` が未設定の場合、起動時にエラーメッセージを出力して終了します

---

## 動作確認（複数ユーザーのテスト）

WebRTC通話のテストには2人以上の参加者が必要です。

| 方法 | 手順 |
|---|---|
| 同一ブラウザ | 通常ウィンドウ + シークレットウィンドウで同じルームIDに参加 |
| 異なるブラウザ | Chrome + Firefox で同じルームIDに参加 |
| 異なるデバイス | 同一ネットワーク内の別端末から `http://<PCのIP>:5173` にアクセス |

PCのIPアドレスは `ifconfig`（Mac/Linux）または `ipconfig`（Windows）で確認できます。

---

## ホットリロード

| 対象 | 仕組み | 動作 |
|---|---|---|
| クライアント | Vite HMR | ファイル保存で即座にブラウザに反映 |
| サーバー | nodemon | ファイル保存でサーバー自動再起動 |

---

## ビルド

```bash
cd client
npm run build      # dist/ に出力
npm run preview    # ビルド結果をプレビュー
```

---

## トラブルシューティング

### ポートが使用中

```bash
# 使用中のプロセスを確認
lsof -i :5173   # クライアント
lsof -i :3001   # サーバー

# プロセスを終了
kill -9 <PID>
```

### 依存関係のエラー

```bash
rm -rf node_modules package-lock.json
npm install
```

### Docker のエラー

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### カメラ/マイクが動作しない

- localhost 以外では HTTPS が必須（WebRTC の制約）
- ブラウザのカメラ/マイク権限を確認
- 他のアプリ（Zoom、Skype等）がデバイスを使用していないか確認

### Chrome で仮想オーディオデバイスが選択される

コンソール（F12）で `[Room] Available audio devices` のログを確認し、実際のマイクが選択されているか確認してください。

---

## 開発ツール

### WebRTC デバッグ（Chrome）

```
chrome://webrtc-internals/
```

接続状態、ICE Candidate、統計情報を確認できます。

### コンソールログ

正常時は以下のようなログが出力されます:

```
[Room] Requesting media devices...
[Room] Media stream obtained: {...}
[createPeer] Creating peer for: <socket-id>
[addPeer] Adding peer for: <socket-id>
```

---

## 次のステップ

- [機能仕様](./features.md) で実装内容を確認
- [VPSデプロイ手順](./deployment.md) で本番環境を構築
- [トラブルシューティング](./troubleshooting.md) で問題解決
