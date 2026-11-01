# 定期メンテナンス

## 日次（確認推奨）

| 項目 | コマンド / 手順 |
|------|---------------|
| サーバー稼働確認 | `pm2 status` で webrtc-server が online か |
| ディスク容量 | `df -h` で `/var/www/web_rtc/server/data/` が肥大化していないか |

## 週次

| 項目 | コマンド / 手順 |
|------|---------------|
| login.log の確認 | `tail -100 /var/www/web_rtc/server/data/login.log` で不審なログインがないか |
| メモリ使用量 | `pm2 monit` で Node.js のメモリリークがないか |
| SSL 証明書の有効期限 | `sudo certbot certificates` で残り日数を確認 |

## 月次

| 項目 | コマンド / 手順 |
|------|---------------|
| npm 脆弱性チェック | `cd server && npm audit` / `cd client && npm audit` |
| Node.js バージョン確認 | `node -v` で LTS の最新パッチが出ていないか確認 |
| login.log のローテーション | 古いログをアーカイブ or 削除 |
| chat-logs/archive の整理 | `ls -la server/chat-logs/archive/` で古いファイルを削除 |
| rooms.json の整理 | 管理画面（`/admin/rooms`）から使われていない Room を削除 |
| users.json の確認 | 管理画面（`/admin`）から不要なユーザーを整理 |

## 四半期

| 項目 | 手順 |
|------|------|
| npm パッケージのメジャーアップデート | React, Vite, Express, Socket.IO 等の更新。`npm outdated` で確認 |
| coturn（STUN/TURN）の確認 | 認証情報の更新、`/var/log/turnserver/` のログ確認 |
| Google OAuth Client ID の確認 | Google Cloud Console で有効期限、承認済みドメインを確認 |
| VPS の OS アップデート | `sudo apt update && sudo apt upgrade -y` |
| バックアップ | `server/data/` ディレクトリのバックアップ（users.json, rooms.json, login.log） |

## 不定期（イベント駆動）

| 項目 | トリガー | 対応 |
|------|---------|------|
| PM2 プロセス再起動 | メモリ使用量の異常増加 | `pm2 restart webrtc-server` |
| Nginx 設定の見直し | ドメイン追加・SSL 更新失敗 | `sudo nginx -t && sudo systemctl restart nginx` |
| TURN 認証情報の変更 | セキュリティインシデント | coturn 設定ファイルを更新し再起動 |
| JWT_SECRET のローテーション | 定期的 or 漏洩疑い | `.env` を更新しサーバー再起動。全ユーザーが再ログイン必要 |
| ADMIN_USER_IDS の更新 | 管理者の追加・削除 | `.env` を更新しサーバー再起動。対象者は再ログイン必要 |

## バックアップ対象ファイル

```
/var/www/web_rtc/server/data/
  ├── users.json      — 登録ユーザー一覧
  ├── rooms.json      — Room データ
  └── login.log       — ログインログ

/var/www/web_rtc/server/.env  — 環境変数（シークレット含む）
```

これらは git に含まれないため、VPS 上でのみ存在します。定期的にバックアップを取ることを推奨します。
