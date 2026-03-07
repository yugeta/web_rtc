# トラブルシューティング

よくある問題と解決方法をまとめています。

## クライアント側の問題

### カメラ/マイクが動作しない

#### 症状
- カメラやマイクへのアクセスが拒否される
- デバイスが検出されない

#### 原因と解決方法

**1. ブラウザの権限が拒否されている**

```
解決方法:
1. ブラウザのアドレスバー左側のアイコンをクリック
2. カメラとマイクの権限を「許可」に変更
3. ページをリロード
```

**2. HTTPで接続している（localhost以外）**

```
原因: WebRTCはHTTPSが必須（localhostを除く）
解決方法: HTTPSで接続するか、localhostを使用
```

**3. 他のアプリケーションがデバイスを使用中**

```
解決方法:
- Zoom、Skype等のビデオ通話アプリを終了
- ブラウザの他のタブでカメラを使用していないか確認
- デバイスを再接続
```

**4. デバイスドライバの問題**

```
解決方法:
- デバイスマネージャーでドライバを確認
- 最新のドライバに更新
- デバイスを再起動
```

### 音声が聞こえない

#### 症状
- 相手の声が聞こえない
- 自分の声が相手に届かない

#### 原因と解決方法

**1. スピーカーがミュートになっている**

```
確認方法:
- スピーカーアイコンが VolumeX（ミュート）になっていないか確認
- クリックしてミュート解除
```

**2. マイクがミュートになっている**

```
確認方法:
- マイクアイコンが MicOff（ミュート）になっていないか確認
- クリックしてミュート解除
```

**3. 仮想オーディオデバイスが選択されている（Chrome）**

```
確認方法:
1. ブラウザのコンソールを開く（F12）
2. 以下のログを確認:
   [Room] Available audio devices: [...]
   [Room] Using audio constraints: {...}

解決方法:
- マイクの選択ドロップダウンから実際のマイクを選択
- 仮想デバイス（Virtual、BlackHole等）を避ける
```

**4. 出力デバイスが間違っている**

```
解決方法:
- スピーカーの選択ドロップダウンから正しいデバイスを選択
- システムのデフォルト出力デバイスを確認
```

### ビデオが表示されない

#### 症状
- 自分のビデオが表示されない
- 相手のビデオが表示されない

#### 原因と解決方法

**1. カメラがオフになっている**

```
確認方法:
- ビデオアイコンが VideoOff になっていないか確認
- クリックしてカメラをオン
```

**2. WebRTC接続が確立していない**

```
確認方法:
1. ブラウザのコンソールを開く
2. エラーメッセージを確認
3. chrome://webrtc-internals/ で接続状態を確認（Chrome）

解決方法:
- ページをリロード
- ルームに再参加
- ネットワーク接続を確認
```

**3. ファイアウォールがWebRTCをブロック**

```
解決方法:
- 企業ネットワークの場合、IT部門に確認
- VPNを無効化して試す
- 別のネットワークで試す
```

### 音声可視化が動作しない

#### 症状
- マイクアイコンの周りの円が動かない

#### 原因と解決方法

**1. AudioContextがsuspendedになっている**

```
確認方法:
コンソールログで以下を確認:
[AudioVisualizer] AudioContext created, state: suspended

解決方法:
- ページ内をクリック（自動的に再開される）
- マイクをミュート/アンミュートする
```

**2. 音声トラックが取得できていない**

```
確認方法:
コンソールログで以下を確認:
[AudioVisualizer] Stream changed: {audioTracks: 0, ...}

解決方法:
- マイクの権限を確認
- デバイスを再選択
```

## サーバー側の問題

### サーバーが起動しない

#### 症状
- `npm run dev` でエラーが発生
- サーバーに接続できない

#### 原因と解決方法

**1. ポートが既に使用されている**

```
エラーメッセージ:
Error: listen EADDRINUSE: address already in use :::3001

解決方法:
# プロセスを確認
lsof -i :3001

# プロセスを終了
kill -9 <PID>

# または別のポートを使用
PORT=3002 npm run dev
```

**2. 依存関係がインストールされていない**

```
解決方法:
cd server
rm -rf node_modules package-lock.json
npm install
```

**3. TypeScriptのコンパイルエラー**

```
解決方法:
# エラーメッセージを確認
npm run dev

# 型定義をインストール
npm install --save-dev @types/node @types/express @types/cors
```

### Socket.IO接続エラー

#### 症状
- クライアントがサーバーに接続できない
- WebSocketエラーが発生

#### 原因と解決方法

**1. CORSエラー**

```
エラーメッセージ:
Access to XMLHttpRequest has been blocked by CORS policy

解決方法:
server/src/index.ts で CORS設定を確認:

const io = new Server(server, {
  cors: {
    origin: '*',  // 開発環境
    // origin: 'https://your-domain.com',  // 本番環境
    methods: ['GET', 'POST']
  }
});
```

**2. サーバーURLが間違っている**

```
確認方法:
client/src/components/Room.tsx の SERVER_URL を確認

解決方法:
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

環境変数を設定:
# client/.env
VITE_SERVER_URL=http://localhost:3001
```

**3. ファイアウォールがブロック**

```
解決方法:
# ポート3001を開放（本番環境）
sudo ufw allow 3001/tcp

# または Nginx経由でアクセス
```

## 接続の問題

### ルームに参加できない

#### 症状
- ルームIDを入力しても参加できない
- 無限ローディング

#### 原因と解決方法

**1. サーバーに接続できていない**

```
確認方法:
ブラウザのコンソールでエラーを確認

解決方法:
- サーバーが起動しているか確認
- ネットワーク接続を確認
- ブラウザのキャッシュをクリア
```

**2. メディアデバイスの権限がない**

```
解決方法:
- カメラ/マイクの権限を許可
- ページをリロード
```

### 相手と接続できない

#### 症状
- ルームには参加できるが、相手のビデオが表示されない
- 音声が届かない

#### 原因と解決方法

**1. WebRTC接続が確立していない**

```
確認方法:
chrome://webrtc-internals/ で接続状態を確認

解決方法:
- 両方のユーザーがページをリロード
- ルームに再参加
```

**2. NATトラバーサルの問題**

```
原因:
- 厳格なファイアウォール
- 対称型NAT
- 企業ネットワーク

解決方法:
- TURN/STUNサーバーを設定（将来的な対応）
- 別のネットワークで試す
```

**3. ブラウザの互換性問題**

```
確認方法:
- 両方のユーザーが対応ブラウザを使用しているか確認
- Chrome、Firefox、Edgeの最新版を推奨

解決方法:
- ブラウザを最新版に更新
- 別のブラウザで試す
```

## パフォーマンスの問題

### ビデオがカクカクする

#### 症状
- フレームレートが低い
- 映像が遅延する

#### 原因と解決方法

**1. ネットワーク帯域が不足**

```
確認方法:
- スピードテストを実行（https://fast.com/）
- 推奨: 上り/下り 1Mbps以上（参加者1人あたり）

解決方法:
- 他のアプリケーションを終了
- Wi-Fiの場合、有線LANに切り替え
- ルーターに近づく
```

**2. CPUリソースが不足**

```
確認方法:
- タスクマネージャーでCPU使用率を確認

解決方法:
- 他のアプリケーションを終了
- ブラウザのタブを減らす
- 参加者数を減らす（推奨: 6人まで）
```

**3. 複数のビデオストリーム**

```
解決方法:
- 不要な参加者のビデオをオフにしてもらう
- 自分のビデオをオフにする
```

### 音声が途切れる

#### 症状
- 音声が断続的に途切れる
- エコーやノイズが発生

#### 原因と解決方法

**1. ネットワークの不安定**

```
解決方法:
- Wi-Fiの場合、有線LANに切り替え
- ルーターを再起動
- 他のデバイスのネットワーク使用を制限
```

**2. マイクの問題**

```
解決方法:
- 別のマイクデバイスを選択
- マイクの音量を調整
- ヘッドセットを使用（エコー防止）
```

**3. ブラウザのリソース不足**

```
解決方法:
- ブラウザを再起動
- 他のタブを閉じる
- ブラウザのキャッシュをクリア
```

## 本番環境の問題

### HTTPSエラー

#### 症状
- SSL証明書のエラー
- 「安全でない接続」の警告

#### 原因と解決方法

**1. SSL証明書が無効**

```
確認方法:
sudo certbot certificates

解決方法:
# 証明書を更新
sudo certbot renew

# Nginxを再起動
sudo systemctl restart nginx
```

**2. 証明書のパスが間違っている**

```
確認方法:
/etc/nginx/sites-available/webrtc-app の設定を確認

解決方法:
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

### Nginxエラー

#### 症状
- 502 Bad Gateway
- 504 Gateway Timeout

#### 原因と解決方法

**1. バックエンドサーバーが起動していない**

```
確認方法:
pm2 status

解決方法:
pm2 restart webrtc-server
```

**2. プロキシ設定が間違っている**

```
確認方法:
/etc/nginx/sites-available/webrtc-app を確認

解決方法:
location /socket.io/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ...
}

# 設定をテスト
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx
```

**3. タイムアウト設定が短い**

```
解決方法:
location /socket.io/ {
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    # ...
}
```

### PM2エラー

#### 症状
- サーバーが自動的に停止する
- メモリリークが発生

#### 原因と解決方法

**1. メモリ不足**

```
確認方法:
pm2 monit
free -h

解決方法:
# メモリ制限を設定
pm2 start src/index.ts --name webrtc-server --max-memory-restart 500M

# または サーバーのメモリを増やす
```

**2. エラーでクラッシュ**

```
確認方法:
pm2 logs webrtc-server --lines 100

解決方法:
# エラーログを確認して修正
# 自動再起動を設定
pm2 start src/index.ts --name webrtc-server --exp-backoff-restart-delay=100
```

## デバッグ方法

### ブラウザのコンソールログ

```javascript
// 重要なログ
[Room] Requesting media devices...
[Room] Available audio devices: [...]
[Room] Media stream obtained: {...}
[createPeer] Creating peer for: <socket-id>
[addPeer] Adding peer for: <socket-id>
[AudioVisualizer] AudioContext created, state: running
```

### Chrome WebRTC Internals

```
1. chrome://webrtc-internals/ にアクセス
2. 接続状態、統計情報を確認
3. ICE Candidate、SDP情報を確認
```

### サーバーログ

```bash
# PM2のログ
pm2 logs webrtc-server

# Nginxのログ
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### ネットワークデバッグ

```bash
# ポートの確認
sudo netstat -tulpn | grep 3001

# ファイアウォールの確認
sudo ufw status

# DNS解決の確認
nslookup your-domain.com

# 接続テスト
curl -I https://your-domain.com
```

## サポート

問題が解決しない場合:

1. GitHubのIssueを作成
2. 以下の情報を含める:
   - ブラウザとバージョン
   - OS
   - エラーメッセージ
   - コンソールログ
   - 再現手順

## 関連ドキュメント

- [機能仕様](./features.md)
- [ローカル開発環境構築](./local-setup.md)
- [本番環境デプロイ](./production-deployment.md)
