# プロジェクト概要

## アーキテクチャ

このアプリケーションは、WebRTCを使用したP2P（Peer-to-Peer）ビデオ通話システムです。

### システム構成図

```
┌──────────────┐                              ┌──────────────┐
│   Client A   │                              │   Client B   │
│  (Browser)   │                              │  (Browser)   │
└──┬───┬───┬───┘                              └───┬───┬───┬──┘
   │   │   │                                      │   │   │
   │   │   │  ◄── WebRTC P2P Media Stream ──►     │   │   │
   │   │   │                                      │   │   │
   │   │   │  WebSocket (Signaling)               │   │   │
   │   │   │      ┌──────────────────────┐        │   │   │
   │   │   └──────┤  sock.mynt.work      ├────────┘   │   │
   │   │          │  Socket.IO Server    │             │   │
   │   │          │  (Node.js + Express) │             │   │
   │   │          └──────────────────────┘             │   │
   │   │                                               │   │
   │   │  STUN/TURN (NAT越え)                          │   │
   │   │          ┌──────────────────────┐             │   │
   │   └──────────┤  stun.mynt.work      ├─────────────┘   │
   │              │  coturn              │                  │
   │              │  STUN  :3478 (UDP)   │                  │
   │              │  TURN  :3478 (UDP)   │                  │
   │              │  TURNS :5349 (TLS)   │                  │
   │              └──────────────────────┘                  │
   │                                                        │
   │  HTTPS (静的ファイル配信)                                │
   │              ┌──────────────────────┐                  │
   └──────────────┤  GitHub Pages        ├──────────────────┘
                  │  or VPS + Nginx      │
                  │  (client/dist)       │
                  └──────────────────────┘
```

### サーバー構成

| サーバー | ドメイン | 役割 |
|---------|---------|------|
| シグナリングサーバー | `sock.mynt.work` | Socket.IOによるWebRTCシグナリング中継 |
| STUN/TURNサーバー | `stun.mynt.work` | NAT越え（アドレス解決・メディアリレー） |
| クライアント配信 | GitHub Pages or VPS | ビルド済み静的ファイルの配信 |

### コンポーネント構成

#### 1. クライアント（React + Vite）

**主要コンポーネント:**

- `App.tsx`: ルーム入室前の画面とルーム管理
- `Room.tsx`: ビデオ通話のメインコンポーネント
  - メディアデバイス管理（マイク、カメラ、スピーカー）
  - WebRTC接続管理（ICEサーバー: `stun.mynt.work`）
  - Socket.IO通信（接続先: `sock.mynt.work`）
- `AudioVisualizer.tsx`: 音声レベルの可視化
- `ScreenShareView.tsx`: 画面共有の表示

**技術的特徴:**

- **WebRTC**: P2Pでのメディアストリーム送受信
- **Simple-Peer**: WebRTC接続の簡易化ライブラリ
- **Socket.IO Client**: シグナリング通信
- **Web Audio API**: 音声の可視化とデバイス管理

#### 2. シグナリングサーバー（Node.js + Express）

**ホスト:** `sock.mynt.work`

**役割:**

- WebRTCシグナリングサーバー
- ルーム管理
- ユーザー接続状態の管理

**主要機能:**

- `join-room`: ルームへの参加処理
- `signal`: WebRTCシグナル（Offer/Answer/ICE Candidate）の中継
- `user-connected`: 新規ユーザー参加の通知
- `user-disconnected`: ユーザー退出の通知

#### 3. STUN/TURNサーバー（coturn）

**ホスト:** `stun.mynt.work`（IP: `140.227.33.218`）

**役割:**

- STUN: クライアントのグローバルIPアドレス解決
- TURN: P2P接続不可時のメディアストリームリレー

**ポート:**

- UDP/TCP 3478: STUN/TURN
- TLS 5349: TURNS（TLS経由のTURN）

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
4. **STUN/TURNサーバー**: Google公開STUN + `stun.mynt.work` でNAT越えに対応
5. **TLS対応**: TURNS（ポート5349）でTLS経由のTURN接続をサポート
6. **ICEフォールバック**: Google STUN → 自前STUN → TURN → TURNS の順で接続を試行

### 本番環境で必要な対策

1. **HTTPS必須**: WebRTCはHTTPSが必須（GitHub Pages使用時はデフォルトで対応）
2. **認証・認可**: ルームアクセス制御
3. **レート制限**: DoS攻撃対策
4. **環境変数管理**: APIキーやシークレットの保護
5. **TURN認証の強化**: 現在は固定ユーザー/パスワード、REST API認証への移行を検討

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
