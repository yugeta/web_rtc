# PWA プッシュ通知 デプロイガイド

`main` ブランチに push すればクライアント・サーバーともに自動デプロイされますが、初回のみ以下の手動設定が必要です。

---

## 初回のみ必要な作業

### 1. VAPID 鍵の生成（本番用）

開発用の鍵がすでに `.env` に入っていますが、本番環境では新しい鍵ペアを生成してください。

```bash
# ローカルで実行
cd server
npx web-push generate-vapid-keys
```

出力例:
```
Public Key:  BNhJp3Xv...（base64 文字列）
Private Key: 4h8sLk2Q...（base64 文字列）
```

### 2. VPS サーバーの環境変数に追加

```bash
ssh ubuntu@<VPSのIPアドレス>
cd /var/www/web_rtc/server

# .env に VAPID 鍵を追加
cat >> .env << 'EOF'
VAPID_PUBLIC_KEY=<生成した公開鍵>
VAPID_PRIVATE_KEY=<生成した秘密鍵>
VAPID_SUBJECT=mailto:admin@example.com
EOF
```

`VAPID_SUBJECT` は通知の送信元を示すメールアドレスです。実際の連絡先に変更してください。

### 3. GitHub Actions の Secrets に VAPID 公開鍵を追加

クライアントのビルド時に VAPID 公開鍵が必要です。

1. GitHub リポジトリ → Settings → Secrets and variables → Actions
2. 「New repository secret」をクリック
3. Name: `VITE_VAPID_PUBLIC_KEY`
4. Value: 手順1で生成した公開鍵（サーバーの `VAPID_PUBLIC_KEY` と同じ値）

### 4. GitHub Actions ワークフローの更新

`.github/workflows/deploy.yml` のビルドステップに環境変数を追加する必要があります。

```yaml
      - run: npx vite build
        working-directory: client
        env:
          VITE_SERVER_URL: https://sock.mynt.work
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}  # ← 追加
```

### 5. PWA アイコンの差し替え

`client/public/icons/` にプレースホルダーアイコンが配置されています。本番前に実際のアプリアイコンに差し替えてください。

- `icon-192x192.png` — 192×192px
- `icon-512x512.png` — 512×512px

背景色は `#1a1a2e`（テーマカラー）に合わせると、スプラッシュスクリーンで自然に見えます。

---

## 自動デプロイの流れ（初回設定後）

上記の設定が完了していれば、以降は `main` に push するだけで自動デプロイされます。

### クライアント（GitHub Pages）

```
main に push
  → .github/workflows/deploy.yml が実行
  → npm ci → vite build（VITE_VAPID_PUBLIC_KEY 含む）
  → GitHub Pages にデプロイ
```

Service Worker と manifest.json はビルド時に自動生成されます。

### サーバー（VPS）

```
main に push（server/** に変更がある場合）
  → .github/workflows/deploy-server.yml が実行
  → SSH で VPS に接続
  → git pull → npm install → npm run build → pm2 restart
```

`web-push` パッケージは `npm install` で自動インストールされます。VAPID 鍵は `.env` から読み込まれます。

---

## 確認方法

### サーバー側

```bash
ssh ubuntu@<VPSのIPアドレス>

# プッシュ通知が有効か確認
curl -s https://sock.mynt.work/api/push/vapid-public-key
# → {"publicKey":"BNhJp3Xv..."} が返れば OK

# VAPID 鍵が未設定の場合
# → {"error":"VAPID public key not configured"} + サーバーログに警告
```

### クライアント側

1. ブラウザで `https://yugeta.github.io/web_rtc/` にアクセス
2. ログイン後、Dashboard に「通知を有効にする」バナーが表示されることを確認
3. Chrome DevTools → Application → Manifest でマニフェスト情報を確認
4. Chrome DevTools → Application → Service Workers で SW が登録されていることを確認

### PWA インストール

- Chrome: アドレスバー右のインストールアイコン、または「ホーム画面に追加」
- Safari (iOS): 共有ボタン → 「ホーム画面に追加」
- Android Chrome: メニュー → 「アプリをインストール」

---

## トラブルシューティング

| 症状 | 原因と対処 |
|------|-----------|
| 通知バナーが表示されない | ブラウザが Push API 非対応、または VAPID 公開鍵が未設定。DevTools Console を確認 |
| 通知許可後も通知が届かない | サーバーの VAPID 鍵が未設定（ログに警告が出る）。VPS の `.env` を確認 |
| Service Worker が登録されない | HTTPS でないとSWは動作しない。GitHub Pages は HTTPS なので通常は問題なし |
| PWA インストールボタンが出ない | manifest.json の設定不備。DevTools → Application → Manifest でエラーを確認 |
| 410 Gone エラーがログに出る | Subscription の期限切れ。自動削除されるので正常動作 |

---

## 注意事項

- VAPID 秘密鍵は絶対に公開リポジトリにコミットしないでください
- VAPID 鍵を変更すると、既存の全 Subscription が無効になります（ユーザーは再購読が必要）
- iOS Safari は iOS 16.4 以降で Web Push に対応していますが、PWA としてインストールした場合のみ動作します
