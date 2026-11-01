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

- `App.tsx`: ルーティング定義（react-router-dom）
- `LandingPage.tsx`: Google ログイン画面
- `Dashboard.tsx`: Room 管理画面（作成・一覧・削除・URL 共有）
- `RoomPage.tsx`: Room 参加画面（Room 存在チェック → 名前入力 → PreJoin → Room）
- `ProtectedRoute.tsx`: 認証ガードコンポーネント
- `AuthContext.tsx`: 認証状態管理（JWT + ユーザー情報）
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
**サーバー上の配置先:** `/var/www/web_rtc/server/`

**役割:**

- WebRTCシグナリングサーバー
- Google OAuth トークン検証 + JWT 発行（`/api/auth/google`）
- Room 管理 REST API（`/api/rooms`）
- Room データの JSON ファイル永続化
- ルーム管理
- ユーザー接続状態の管理

**主要機能:**

- `join-room`: ルームへの参加処理
- `signal`: WebRTCシグナル（Offer/Answer/ICE Candidate）の中継
- `user-connected`: 新規ユーザー参加の通知
- `user-disconnected`: ユーザー退出の通知

> ソースコードは `server/` ディレクトリにあります。`sock/` フォルダは以前の別プロジェクトのもので、本プロジェクトでは使用しません。

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
7. **Google OAuth 認証**: Room 管理者は Google アカウントで認証
8. **JWT 認証**: サーバー発行の JWT でAPI・Socket.IO 接続を保護
9. **Room アクセス制御**: Room 管理 API は JWT 認証必須、Room 参加は認証不要

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

## マルチドメインデプロイ

### 現在の構成

クライアント（静的ファイル）とサーバー（API + シグナリング）は既に別サーバーで動作している。クライアントは GitHub Pages、サーバーは VPS。

### クライアントを複数ドメインに設置した場合

クライアントは静的ファイルなので、任意のサーバー・ドメインに設置可能。全てのクライアントが同じサーバー（`sock.mynt.work`）に接続するため、異なるドメインからアクセスしても同じ Room で通話できる。

```
site-a.com/web_rtc/room/xxx  ─┐
                               ├─► sock.mynt.work ─► 同じ Room
site-b.com/web_rtc/room/xxx  ─┘
```

### メリット

- ブランド別・顧客別にドメインを分けられる
- CDN を変えてアクセス速度を地域ごとに最適化
- クライアントの UI をカスタマイズした別バージョンを配信可能

### 必要な追加設定

| 項目 | 対応内容 |
|------|---------|
| Google OAuth | Google Cloud Console の「承認済み JavaScript 生成元」に新ドメインを追加 |
| CORS | サーバーの CORS 設定に新ドメインを許可（現在は `origin: '*'` なので対応不要） |
| Vite base path | ドメインごとに `base` の設定を変更する可能性あり |

### 認証の制約

JWT は localStorage に保存されるため、ドメインが異なるとログイン状態は共有されない（ブラウザのセキュリティ仕様）。各ドメインで個別にログインが必要。

ドメイン間でログイン状態を共有するには、認証方式をサーバー側 Cookie ベース（`httpOnly` + `SameSite=None`）に変更する必要がある。現時点では対応不要だが、将来の拡張候補として記録。
