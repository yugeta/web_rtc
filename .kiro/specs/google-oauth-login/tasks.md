# 実装計画: Google OAuth ログイン

## 概要

WebRTC Meet に Google OAuth ログイン機能を追加し、react-router-dom によるルーティング、JWT 認証、Room 管理 API、Dashboard 画面を段階的に実装する。サーバー側の認証・データ層から構築し、クライアント側のルーティング・認証・UI を接続していく。

## タスク

- [x] 1. サーバー側の依存パッケージ追加と環境変数バリデーション
  - `google-auth-library`、`jsonwebtoken`、`uuid` とその型定義を `server/package.json` に追加
  - `server/src/index.ts` の起動時に `GOOGLE_CLIENT_ID`、`JWT_SECRET` 環境変数の存在チェックを追加し、未設定時は `process.exit(1)` する
  - `docker-compose.yml` に `GOOGLE_CLIENT_ID`、`JWT_SECRET` 環境変数を追加
  - _Requirements: 9.2, 9.3, 9.4_

- [ ] 2. RoomStore の実装
  - [x] 2.1 `server/src/roomStore.ts` を作成
    - `RoomData` インターフェースを定義（id, name, ownerId, ownerName, createdAt, settings）
    - `load()`, `save()`, `create()`, `findByOwner()`, `findById()`, `remove()` メソッドを実装
    - JSON ファイル（`server/data/rooms.json`）への読み書き、ファイル不存在時の空配列初期化
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 2.2 RoomStore のプロパティベーステストを作成
    - **Property 6: RoomStore シリアライゼーションラウンドトリップ**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.7**

  - [ ]* 2.3 RoomStore のユニットテストを作成
    - ファイル不存在時の初期化、create/findByOwner/findById/remove の正常系・異常系
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3. JWT 認証モジュールと認証ミドルウェアの実装
  - [x] 3.1 `server/src/routes/auth.ts` を作成
    - `POST /api/auth/google` エンドポイント: `google-auth-library` で ID トークンを検証し、`jsonwebtoken` で JWT を生成して返す
    - JWT ペイロード: `{ sub, name, email, picture }`、有効期限 7 日、HS256
    - 無効な ID トークンの場合は 401 を返す
    - _Requirements: 1.4, 1.5_

  - [x] 3.2 `server/src/middleware/auth.ts` を作成
    - Authorization ヘッダーから Bearer トークンを抽出し `jsonwebtoken.verify()` で検証
    - 成功時は `req.user` にデコード結果を付与、失敗時は 401 を返す
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.3 JWT ラウンドトリップのプロパティベーステストを作成
    - **Property 1: JWT 生成・検証ラウンドトリップ**
    - **Validates: Requirements 1.4, 2.1, 2.4**

  - [ ]* 3.4 無効 JWT 拒否のプロパティベーステストを作成
    - **Property 2: 無効な JWT は 401 を返す**
    - **Validates: Requirements 2.2**

  - [ ]* 3.5 認証 API とミドルウェアのユニットテストを作成
    - `POST /api/auth/google` の正常系・異常系
    - ミドルウェアの各エラーケース（ヘッダーなし、Bearer なし、期限切れ）
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Room 管理 API の実装
  - [x] 4.1 `server/src/routes/rooms.ts` を作成
    - `POST /api/rooms` : Room 作成（authMiddleware 必須）
    - `GET /api/rooms` : 自分の Room 一覧取得（authMiddleware 必須）
    - `DELETE /api/rooms/:id` : Room 削除（authMiddleware 必須、所有者チェック）
    - `GET /api/rooms/:id/exists` : Room 存在チェック（認証不要）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.2 Room 作成→一覧のプロパティベーステストを作成
    - **Property 3: Room 作成後にオーナー一覧に含まれる**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 4.3 Room 削除→消失のプロパティベーステストを作成
    - **Property 4: Room 削除後に一覧に含まれない**
    - **Validates: Requirements 3.3**

  - [ ]* 4.4 他人の Room 削除不可のプロパティベーステストを作成
    - **Property 5: 他人の Room は削除できない**
    - **Validates: Requirements 3.4**

  - [ ]* 4.5 Room API のユニットテストを作成
    - 各エンドポイントの正常系・異常系、`GET /api/rooms/:id/exists` の存在・不存在
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. サーバーのルート統合と Socket.IO JWT 認証
  - [x] 5.1 `server/src/index.ts` に認証ルートと Room ルートをマウント
    - `app.use('/api/auth', authRouter)` と `app.use('/api/rooms', roomsRouter)` を追加
    - `express.json()` ミドルウェアを追加
    - _Requirements: 1.4, 3.6_

  - [x] 5.2 Socket.IO に JWT 認証ミドルウェアを追加
    - `io.use()` で `auth.token` を検証、有効なら `socket.data.user` にユーザー情報を付与
    - 無効/なしの場合はそのまま接続を許可
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.3 Socket.IO JWT 認証のプロパティベーステストを作成
    - **Property 10: Socket.IO 有効 JWT でユーザー情報が付与される**
    - **Validates: Requirements 8.2**

  - [ ]* 5.4 Socket.IO 無効 JWT 許可のプロパティベーステストを作成
    - **Property 11: Socket.IO 無効 JWT でも接続が許可される**
    - **Validates: Requirements 8.3**

- [x] 6. チェックポイント - サーバー側の全テスト確認
  - すべてのテストが通ることを確認し、問題があればユーザーに質問する。

- [ ] 7. クライアント側の依存パッケージ追加とルーティング基盤
  - [x] 7.1 クライアントの依存パッケージを追加
    - `react-router-dom`、`@react-oauth/google` を `client/package.json` に追加
    - `VITE_GOOGLE_CLIENT_ID` を `client/.env.production` に追加
    - _Requirements: 5.1, 9.1_

  - [x] 7.2 `client/src/main.tsx` を変更
    - `BrowserRouter`（`basename="/web_rtc/"`）、`GoogleOAuthProvider`、`AuthProvider` でアプリをラップ
    - _Requirements: 5.1, 1.2_

  - [x] 7.3 `client/src/contexts/AuthContext.tsx` を作成
    - `AuthUser`、`AuthContextType` インターフェースを定義
    - `login()`: ID トークンを `POST /api/auth/google` に送信し JWT を localStorage に保存
    - `logout()`: localStorage クリア、state リセット
    - 初期化時に localStorage から JWT を読み込み認証状態を復元
    - _Requirements: 1.6, 1.7_

  - [ ]* 7.4 localStorage JWT ラウンドトリップのプロパティベーステストを作成
    - **Property 12: localStorage JWT 保存ラウンドトリップ**
    - **Validates: Requirements 1.7**

- [ ] 8. クライアントページコンポーネントの実装
  - [x] 8.1 `client/src/components/ProtectedRoute.tsx` を作成
    - AuthContext の `isAuthenticated` を確認し、未認証なら `/` にリダイレクト
    - `isLoading` 中はローディング表示
    - _Requirements: 5.5_

  - [x] 8.2 `client/src/pages/LandingPage.tsx` を作成
    - `@react-oauth/google` の `GoogleLogin` コンポーネントを表示
    - ログイン成功時に `AuthContext.login()` を呼び出し
    - 認証済みなら `/dashboard` にリダイレクト
    - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.6_

  - [x] 8.3 `client/src/pages/Dashboard.tsx` を作成
    - Room 一覧取得（`GET /api/rooms`）、Room 作成（`POST /api/rooms`）、Room 削除（`DELETE /api/rooms/:id`）
    - 各 Room に Room 名、作成日時、参加用 URL を表示
    - URL 共有ボタン（`navigator.clipboard.writeText()`）
    - 削除確認ダイアログ
    - ログアウトボタン、プロフィール画像・名前表示
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.4 `client/src/pages/RoomPage.tsx` を作成
    - `useParams()` で `:id` を取得
    - `GET /api/rooms/:id/exists` で Room 存在チェック
    - 存在しない場合はエラー表示、存在する場合は PreJoin → Room の既存フローを維持
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.5 ルーティングガードのプロパティベーステストを作成
    - **Property 7: 認証状態に基づくルーティングガード**
    - **Validates: Requirements 5.5, 5.6**

  - [ ]* 8.6 Room ページ認証不要のプロパティベーステストを作成
    - **Property 8: /room/:id は認証不要**
    - **Validates: Requirements 5.7**

  - [ ]* 8.7 Dashboard Room 表示のプロパティベーステストを作成
    - **Property 9: Dashboard の Room 表示に必要情報が含まれる**
    - **Validates: Requirements 6.2**

- [ ] 9. App.tsx のルーティング移行と統合
  - [x] 9.1 `client/src/App.tsx` をルーターベースに書き換え
    - 既存の state ベースの画面切り替えを `Routes` / `Route` に置き換え
    - `/` → `LandingPage`、`/dashboard` → `ProtectedRoute` → `Dashboard`、`/room/:id` → `RoomPage`、`*` → NotFound
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 9.2 Socket.IO 接続に JWT を含める
    - Room コンポーネントの Socket.IO 接続時に、AuthContext から JWT を取得して `auth` オプションに含める
    - _Requirements: 8.1_

  - [ ]* 9.3 ページコンポーネントのユニットテストを作成
    - LandingPage のログインボタン表示、AuthContext の login/logout フロー
    - ProtectedRoute のリダイレクト動作
    - Dashboard の Room 一覧表示・作成・削除・URL 共有
    - RoomPage の Room 存在チェック・エラー表示
    - _Requirements: 1.1, 5.5, 5.6, 6.1, 6.3, 6.5, 7.1, 7.4_

- [x] 10. 最終チェックポイント - 全テスト確認
  - すべてのテストが通ることを確認し、問題があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP を優先する場合はスキップ可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントでインクリメンタルな検証を実施
- プロパティベーステストは `fast-check` を使用し、普遍的な正当性プロパティを検証
- ユニットテストは具体的な例とエッジケースを検証
