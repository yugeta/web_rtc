# プロジェクト概要

## アーキテクチャ

このアプリケーションは、WebRTCを使用したP2P（Peer-to-Peer）ビデオ通話システムです。

### システム構成図

```
┌─────────────┐         ┌─────────────┐
│   Client A  │         │   Client B  │
│  (Browser)  │         │  (Browser)  │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │  WebSocket (Signaling)│
       │         ┌─────┐       │
       └─────────┤     │───────┘
                 │ Server│
                 │(Socket.IO)│
                 └─────┘
       
       WebRTC (P2P Media Stream)
       ◄─────────────────────────►
```

### コンポーネント構成

#### 1. クライアント（React + Vite）

**主要コンポーネント:**

- `App.tsx`: ルーム入室前の画面とルーム管理
- `Room.tsx`: ビデオ通話のメインコンポーネント
  - メディアデバイス管理（マイク、カメラ、スピーカー）
  - WebRTC接続管理
  - Socket.IO通信
- `AudioVisualizer.tsx`: 音声レベルの可視化
- `VideoPlayer.tsx`: 個別のビデオストリーム表示

**技術的特徴:**

- **WebRTC**: P2Pでのメディアストリーム送受信
- **Simple-Peer**: WebRTC接続の簡易化ライブラリ
- **Socket.IO Client**: シグナリング通信
- **Web Audio API**: 音声の可視化とデバイス管理

#### 2. サーバー（Node.js + Express）

**役割:**

- WebRTCシグナリングサーバー
- ルーム管理
- ユーザー接続状態の管理

**主要機能:**

- `join-room`: ルームへの参加処理
- `signal`: WebRTCシグナル（Offer/Answer/ICE Candidate）の中継
- `user-connected`: 新規ユーザー参加の通知
- `user-disconnected`: ユーザー退出の通知

## データフロー

### 1. ルーム参加フロー

```
Client A                Server              Client B
   │                      │                    │
   ├─ join-room ────────►│                    │
   │                      ├─ user-connected ─►│
   │◄─── all-users ──────┤                    │
   │                      │                    │
```

### 2. WebRTC接続確立フロー

```
Client A (Initiator)    Server              Client B (Receiver)
   │                      │                    │
   ├─ createPeer() ──────┤                    │
   ├─ signal(offer) ────►│                    │
   │                      ├─ signal(offer) ──►│
   │                      │                    ├─ addPeer()
   │                      │◄─ signal(answer)──┤
   │◄─ signal(answer) ───┤                    │
   │                      │                    │
   ├─ ICE candidates ───►│◄─ ICE candidates ─┤
   │                      │                    │
   │◄──── P2P Media Stream ──────────────────►│
```

### 3. メディアストリーム管理

```
getUserMedia()
    ↓
MediaStream (audio + video)
    ↓
    ├─► Peer Connection (WebRTC)
    │       ↓
    │   Remote Peer
    │
    ├─► AudioContext (Visualization)
    │       ↓
    │   Canvas Rendering
    │
    └─► Local Video Element
```

## セキュリティ考慮事項

### 実装済み

1. **CORS設定**: サーバー側でCORS制御
2. **メディアデバイス権限**: ブラウザのネイティブ権限管理
3. **P2P通信**: メディアストリームはサーバーを経由しない

### 本番環境で必要な対策

1. **HTTPS必須**: WebRTCはHTTPSが必須
2. **TURN/STUNサーバー**: NAT越えのための中継サーバー
3. **認証・認可**: ルームアクセス制御
4. **レート制限**: DoS攻撃対策
5. **環境変数管理**: APIキーやシークレットの保護

## スケーラビリティ

### 現在の制限

- P2P接続のため、参加者数が増えると各クライアントの負荷が増大
- 推奨: 4-6人まで

### スケールアップの方法

1. **SFU（Selective Forwarding Unit）の導入**
   - メディアサーバー（Janus、Mediasoup等）を使用
   - サーバーがストリームを中継

2. **MCU（Multipoint Control Unit）の導入**
   - サーバー側でストリームをミキシング
   - クライアントの負荷を軽減

3. **水平スケーリング**
   - Redis等でセッション共有
   - ロードバランサーの導入
