# WebRTC Meet

WebRTCを使用したP2Pビデオ通話アプリケーションです。

## Demo

https://yugeta.github.io/web_rtc/

## クイックスタート

### Docker使用

```bash
git clone <repository-url>
cd <project-directory>
docker-compose up
```

- クライアント: http://localhost:5173
- サーバー: http://localhost:3001

### Docker不使用

```bash
# サーバー
cd server && npm install && npm run dev

# 別ターミナルでクライアント
cd client && npm install && npm run dev
```

## プロジェクト構成

```
├── client/          # React フロントエンド（Vite + TypeScript）
├── server/          # シグナリングサーバー（Node.js + Socket.IO）
├── docs/            # ドキュメント
└── docker-compose.yml
```

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React 19, TypeScript, Vite, Simple-Peer |
| バックエンド | Node.js 20, Express, Socket.IO |
| インフラ | GitHub Pages（クライアント）, VPS + Nginx（シグナリング）, coturn（STUN/TURN） |

## ドキュメント

詳細は [docs/](./docs/) を参照してください。

## ライセンス

ISC
