# SFU（Selective Forwarding Unit）移行

## ステータス: 予定（サーバースペック増強後に着手）

## 背景

現在のフルメッシュ P2P 方式では、参加者数が増えるとクライアントの上り帯域と CPU 負荷が急増し、実用上限は 4〜6人。10人以上の同時参加を実現するには SFU 方式への移行が必要。

## 前提条件

- VPS スペック増強: CPU 2コア以上、メモリ 2GB 以上
- mediasoup の動作要件を満たすサーバー環境

## 変更範囲

### サーバー側（大幅追加）
- mediasoup パッケージの追加
- SFU Worker / Router / Transport / Producer / Consumer の管理ロジック新規実装
- シグナリングイベントの追加（createTransport, produce, consume 等）

### クライアント側（Room.tsx 接続ロジック全面書き換え）
- simple-peer を削除、mediasoup-client に置き換え
- Room.tsx の createPeer/addPeer を Transport/Producer/Consumer パターンに書き換え

### 変更なし
- UI コンポーネント（ビデオグリッド、コントロールバー、チャット）
- Socket.IO シグナリング基盤（イベント名は変わるが仕組みは同じ）
- 認証、Room 管理、Dashboard

## 期待される効果

| 指標 | P2P（現在） | SFU（移行後） |
|------|-----------|-------------|
| 1人あたりの上り帯域（10人時） | 4.5Mbps | 500kbps |
| 実用上限（PC + Wi-Fi） | 6〜8人 | 30〜50人 |
| サーバー負荷 | ほぼなし | 高い（転送処理） |
