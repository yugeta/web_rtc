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

どちらの方法でも、デフォルト値が設定されているので通常は変更不要です。

| 変数 | ファイル | デフォルト値 | 説明 |
|---|---|---|---|
| `VITE_SERVER_URL` | `client/.env` | `http://localhost:3001` | シグナリングサーバーのURL |
| `PORT` | `server/.env` | `3001` | サーバーのリッスンポート |

変更したい場合は各ディレクトリに `.env` ファイルを作成してください。

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
