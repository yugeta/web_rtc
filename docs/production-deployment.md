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

環境変数 `VITE_SERVER_URL=https://sock.mynt.work` は workflow 内で設定済みです。

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
