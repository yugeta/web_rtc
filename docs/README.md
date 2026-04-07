# ドキュメント

## 目次

### はじめに

| ドキュメント | 内容 |
|---|---|
| [プロジェクト概要](./overview.md) | システム構成図、サーバー構成、コンポーネント構成、データフロー、セキュリティ考慮事項 |
| [機能仕様](./features.md) | 実装済み機能の詳細、未実装機能の一覧、ブラウザ互換性、パフォーマンス要件 |

### 開発

| ドキュメント | 内容 |
|---|---|
| [ローカル開発環境構築](./local-setup.md) | Docker / ローカル直接実行のセットアップ、環境変数、開発ワークフロー、テスト方法 |

### デプロイ

| ドキュメント | 内容 |
|---|---|
| [VPSデプロイ手順](./deployment.md) | Ubuntu VPS への初回セットアップ全手順（Node.js, PM2/systemd, Nginx, SSL, ファイアウォール） |
| [本番環境デプロイ](./production-deployment.md) | 現在の本番構成サマリーと日常の更新手順 |

### 運用

| ドキュメント | 内容 |
|---|---|
| [定期メンテナンス](./maintenance.md) | 日次・週次・月次・四半期のメンテナンス項目、バックアップ対象 |
| [トラブルシューティング](./troubleshooting.md) | クライアント/サーバー/接続/パフォーマンスの問題と解決方法 |
| [コーディングルール](./coding-rules/) | CSS、React、全般のコーディング規約（他プロジェクトでも流用可） |

## 本番環境の構成

```
クライアント:  yugeta.github.io/web_rtc/  (GitHub Pages, 自動デプロイ)
シグナリング:  sock.mynt.work             (VPS, Node.js + Nginx リバースプロキシ)
STUN/TURN:    stun.mynt.work             (VPS, coturn)
```

## 読む順番の目安

1. [プロジェクト概要](./overview.md) でアーキテクチャを把握
2. [ローカル開発環境構築](./local-setup.md) で手元で動かす
3. [機能仕様](./features.md) で実装内容を確認
4. デプロイ時は [VPSデプロイ手順](./deployment.md) → [本番環境デプロイ](./production-deployment.md)
5. 問題が起きたら [トラブルシューティング](./troubleshooting.md)
