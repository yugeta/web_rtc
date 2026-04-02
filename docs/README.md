# WebRTC ビデオ通話アプリケーション

リアルタイムビデオ・音声通話を実現するWebRTCベースのアプリケーションです。

## 📚 ドキュメント

- [プロジェクト概要](./overview.md) - アーキテクチャと技術スタック
- [機能仕様](./features.md) - 実装されている機能の詳細
- [ローカル開発環境構築](./local-setup.md) - 開発環境のセットアップ手順
- [本番環境デプロイ](./production-deployment.md) - 本番サーバーへのデプロイ手順
- [トラブルシューティング](./troubleshooting.md) - よくある問題と解決方法

## クイックスタート

### ローカル開発（Docker使用）

```bash
# リポジトリをクローン
git clone <repository-url>
cd <project-directory>

# Docker Composeで起動
docker-compose up

# ブラウザでアクセス
# クライアント: http://localhost:5173
# サーバー: http://localhost:3001
```

### ローカル開発（Docker不使用）

```bash
# サーバーを起動
cd server
npm install
npm run dev

# 別のターミナルでクライアントを起動
cd client
npm install
npm run dev
```

## プロジェクト構成

```
.
├── client/              # Reactフロントエンド
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   ├── App.tsx      # メインアプリケーション
│   │   └── main.tsx     # エントリーポイント
│   └── package.json
├── server/              # Node.jsバックエンド
│   ├── src/
│   │   └── index.ts     # シグナリングサーバー
│   └── package.json
├── docs/                # ドキュメント
└── docker-compose.yml   # Docker設定
```

## 技術スタック

### フロントエンド
- React 19.2
- TypeScript 5.9
- Vite 7.3
- Socket.IO Client 4.8
- Simple-Peer 9.11
- Lucide React (アイコン)

### バックエンド
- Node.js 20
- Express 5.2
- Socket.IO 4.8
- TypeScript 5.9

## ライセンス

ISC

# Demo
> https://yugeta.github.io/web_rtc/
