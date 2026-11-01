# coturn for QNAP Container Station

このディレクトリは、QNAP の Container Station で `stun.mynt.work` / `turn.mynt.work` を同じサーバー上で動かすための Docker Compose です。

## 1. 事前準備

1. `docker/` 配下にある `.env.example` を `.env` にコピーする
2. `EXTERNAL_IP` にこの QNAP の公開 IP を設定する
3. `docker/certs` フォルダに、`fullchain.pem` と `privkey.pem` を配置する
   - 例: Let's Encrypt で取得した証明書

## 2. 起動

```bash
cd docker
cp .env.example .env
# .env を編集
# EXTERNAL_IP=xxx.xxx.xxx.xxx
# TURN_USERNAME=mynt
# TURN_PASSWORD=myntpass

docker compose up -d
```

## 3. 使い方

- STUN: `stun:stun.mynt.work:3478`
- TURN: `turn:stun.mynt.work:3478`
- TURNS: `turns:stun.mynt.work:5349`

認証情報は以下の通りです。

- username: `mynt`
- password: `myntpass`

## 4. 注意事項

- `EXTERNAL_IP` は NAT の背後で使う場合に必須です
- 3478 / 5349 の UDP/TCP のポート開放とルーター転送が必要です
- 本番では `myntpass` を安全な値へ変更してください
- 認証情報はアプリ側の ICE サーバー定義と一致させてください
