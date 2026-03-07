# ローカル開発環境構築

## 前提条件

### 必須
- **Node.js**: v20以上
- **npm**: v10以上（Node.jsに同梱）
- **Git**: 最新版

### オプション（Docker使用時）
- **Docker**: v20以上
- **Docker Compose**: v2以上

## セットアップ方法

### 方法1: Docker Composeを使用（推奨）

最も簡単な方法です。

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd <project-directory>

# 2. Docker Composeで起動
docker-compose up

# 3. ブラウザでアクセス
# クライアント: http://localhost:5173
# サーバー: http://localhost:3001
```

#### バックグラウンドで起動

```bash
docker-compose up -d
```

#### ログの確認

```bash
docker-compose logs -f
```

#### 停止

```bash
docker-compose down
```

### 方法2: ローカルで直接実行

Node.jsを直接使用する方法です。

#### サーバーのセットアップ

```bash
# 1. サーバーディレクトリに移動
cd server

# 2. 依存関係をインストール
npm install

# 3. 開発サーバーを起動
npm run dev

# サーバーが http://localhost:3001 で起動します
```

#### クライアントのセットアップ

別のターミナルウィンドウで実行します。

```bash
# 1. クライアントディレクトリに移動
cd client

# 2. 依存関係をインストール
npm install

# 3. 開発サーバーを起動
npm run dev

# クライアントが http://localhost:5173 で起動します
```

## 環境変数の設定

### クライアント

`client/.env` ファイルを作成（オプション）:

```env
VITE_SERVER_URL=http://localhost:3001
```

デフォルトでは `http://localhost:3001` が使用されます。

### サーバー

`server/.env` ファイルを作成（オプション）:

```env
PORT=3001
```

デフォルトでは `3001` が使用されます。

## 開発ワークフロー

### コードの変更

両方のサーバーはホットリロードに対応しています。

- **クライアント**: ファイル保存時に自動リロード（Vite HMR）
- **サーバー**: ファイル保存時に自動再起動（nodemon）

### ビルド

#### クライアントのビルド

```bash
cd client
npm run build
```

ビルド成果物は `client/dist/` に出力されます。

#### ビルドのプレビュー

```bash
cd client
npm run preview
```

### Lint

```bash
cd client
npm run lint
```

## トラブルシューティング

### ポートが既に使用されている

#### クライアント（5173）が使用中の場合

```bash
# プロセスを確認
lsof -i :5173

# プロセスを終了
kill -9 <PID>
```

または、別のポートを使用:

```bash
cd client
vite --port 5174
```

#### サーバー（3001）が使用中の場合

```bash
# プロセスを確認
lsof -i :3001

# プロセスを終了
kill -9 <PID>
```

または、環境変数で別のポートを指定:

```bash
PORT=3002 npm run dev
```

### 依存関係のエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### Dockerのエラー

```bash
# コンテナとイメージを削除して再ビルド
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### ブラウザでカメラ/マイクが動作しない

1. **HTTPSが必要**: ローカルホスト以外ではHTTPSが必須
2. **権限の確認**: ブラウザの設定でカメラ/マイクの権限を確認
3. **デバイスの確認**: 他のアプリケーションがデバイスを使用していないか確認

### Chrome特有の問題

#### 仮想オーディオデバイスが選択される

コンソールログで以下を確認:

```
[Room] Available audio devices: [...]
[Room] Using audio constraints: {...}
```

実際のマイクが選択されているか確認してください。

#### AudioContextがsuspendedになる

ページをクリックすると自動的に再開されます。

## 開発ツール

### 推奨VSCode拡張機能

- **ESLint**: コードの静的解析
- **Prettier**: コードフォーマッター
- **TypeScript Vue Plugin (Volar)**: TypeScript補完
- **Docker**: Docker管理

### ブラウザ開発ツール

#### Chrome DevTools

1. **Console**: ログの確認
2. **Network**: WebSocket通信の確認
3. **Application > Storage**: LocalStorageの確認

#### WebRTC Internals

Chrome専用のWebRTCデバッグツール:

```
chrome://webrtc-internals/
```

接続状態、統計情報、ICE Candidateなどを確認できます。

## テスト方法

### 複数ユーザーのシミュレーション

#### 方法1: 複数のブラウザウィンドウ

1. 通常ウィンドウで `http://localhost:5173` を開く
2. シークレットウィンドウで `http://localhost:5173` を開く
3. 同じルームIDを入力して参加

#### 方法2: 異なるブラウザ

1. Chromeで `http://localhost:5173` を開く
2. Firefoxで `http://localhost:5173` を開く
3. 同じルームIDを入力して参加

#### 方法3: 異なるデバイス

同じネットワーク内の別デバイスから接続:

1. サーバーのIPアドレスを確認: `ifconfig` (Mac/Linux) または `ipconfig` (Windows)
2. 別デバイスから `http://<IP-ADDRESS>:5173` にアクセス

例: `http://192.168.1.100:5173`

### デバッグログの確認

コンソールに以下のログが表示されます:

```
[Room] Requesting media devices...
[Room] Available audio devices: [...]
[Room] Media stream obtained: {...}
[AudioVisualizer] AudioContext created, state: running
[createPeer] Creating peer for: <socket-id>
[addPeer] Adding peer for: <socket-id>
```

## 次のステップ

- [機能仕様](./features.md)を確認
- [本番環境デプロイ](./production-deployment.md)を参照
- [トラブルシューティング](./troubleshooting.md)を確認
