# 実装計画: PWA プッシュ通知

## 概要

既存の Vite + React + TypeScript クライアントと Express + Socket.IO サーバーに、PWA 機能と Web Push 通知を段階的に追加する。サーバー側のデータストア・サービス層から構築し、クライアント側の PWA 化・UI 統合へと進め、最後に Socket.IO イベント連携で全体を結合する。

## タスク

- [x] 1. サーバー側の基盤構築
  - [x] 1.1 環境変数と VAPID 鍵の設定
    - `server/.env` に `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT` を追加
    - `client/.env` に `VITE_VAPID_PUBLIC_KEY` を追加
    - `server/src/index.ts` で VAPID 鍵の存在チェックと警告ログ出力を実装
    - `web-push` パッケージを `server` の dependencies に追加
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.2 SubscriptionStore の実装 (`server/src/subscriptionStore.ts`)
    - `SubscriptionRecord` インターフェース定義（userSub, deviceId, subscription, createdAt）
    - `save`, `findByUser`, `remove`, `removeByUser`, `removeByEndpoint` メソッドを実装
    - JSON ファイル (`server/data/subscriptions.json`) への永続化
    - 既存の `userStore.ts` / `roomStore.ts` と同じパターンに従う
    - _Requirements: 3.4, 3.5, 3.7, 9.1, 9.2, 9.4_

  - [ ]* 1.3 SubscriptionStore のプロパティテスト: Property 4 - Subscription 永続化ラウンドトリップ
    - **Property 4: Subscription 永続化ラウンドトリップ**
    - 任意の有効な SubscriptionRecord を保存後、同じ userSub で検索して同一データが取得できることを検証
    - テストファイル: `server/src/__tests__/subscriptionStore.test.ts`
    - **Validates: Requirements 3.4, 9.1**

  - [ ]* 1.4 SubscriptionStore のプロパティテスト: Property 5 - 購読解除による Subscription 削除
    - **Property 5: 購読解除による Subscription 削除**
    - 保存済み SubscriptionRecord を削除後、検索結果が空であることを検証
    - テストファイル: `server/src/__tests__/subscriptionStore.test.ts`
    - **Validates: Requirements 3.5**

  - [ ]* 1.5 SubscriptionStore のプロパティテスト: Property 6 - ログアウト時の全 Subscription 削除
    - **Property 6: ログアウト時の全 Subscription 削除**
    - N 個のデバイスで登録後、removeByUser 実行で全て削除されることを検証
    - テストファイル: `server/src/__tests__/subscriptionStore.test.ts`
    - **Validates: Requirements 3.7**

  - [ ]* 1.6 SubscriptionStore のプロパティテスト: Property 12 - マルチデバイス Subscription 管理
    - **Property 12: マルチデバイス Subscription 管理**
    - 異なる deviceId で N 個登録後、findByUser が正確に N 個返し各 deviceId が一意であることを検証
    - テストファイル: `server/src/__tests__/subscriptionStore.test.ts`
    - **Validates: Requirements 9.2**

- [x] 2. チェックポイント - SubscriptionStore のテスト確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. サーバー側の通知サービスと API
  - [x] 3.1 PushService の実装 (`server/src/pushService.ts`)
    - `web-push` ライブラリの初期化と VAPID 設定
    - `sendNotification(userSub, payload)` メソッド: 指定ユーザーの全デバイスに通知送信
    - `sendToRoom(roomId, payload, excludeUserSub)` メソッド: ルーム参加者のうちバックグラウンド状態のユーザーに通知送信
    - 通知ペイロード生成ロジック（invite, chat, join の各タイプ）
    - chat タイプのメッセージは先頭 100 文字に切り詰め
    - 410 Gone レスポンス時の Subscription 自動削除
    - _Requirements: 5.2, 5.3, 5.5, 6.1, 6.2, 6.4, 7.1, 7.2, 7.4_

  - [x] 3.2 Visibility 状態管理の実装
    - `server/src/index.ts` に `userVisibility` Map を追加
    - Socket.IO `visibility-state` イベントハンドラを追加
    - key: `${userSub}:${roomId}`, value: `'foreground' | 'background'`
    - PushService から参照可能にエクスポート
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 3.3 Visibility 状態のプロパティテスト: Property 11 - Visibility 状態のラウンドトリップ
    - **Property 11: Visibility 状態のラウンドトリップ**
    - 任意のユーザー・ルーム組み合わせで状態設定後、正しい値が取得できることを検証
    - テストファイル: `server/src/__tests__/visibilityState.test.ts`
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 3.4 PushService のプロパティテスト: Property 7 - 全登録デバイスへの通知配信
    - **Property 7: 全登録デバイスへの通知配信**
    - N 個のデバイス登録ユーザーへの通知送信が N 回の web-push 送信を試行することを検証
    - テストファイル: `server/src/__tests__/pushService.test.ts`
    - **Validates: Requirements 5.2, 9.3**

  - [ ]* 3.5 PushService のプロパティテスト: Property 8 - 通知ペイロードの必須フィールド
    - **Property 8: 通知ペイロードの必須フィールド**
    - invite/chat/join 各タイプのペイロードが必須フィールドを含むことを検証
    - テストファイル: `server/src/__tests__/pushService.test.ts`
    - **Validates: Requirements 5.3, 6.2, 7.2**

  - [ ]* 3.6 PushService のプロパティテスト: Property 9 - バックグラウンド参加者のみへの通知送信
    - **Property 9: バックグラウンド参加者のみへの通知送信**
    - フォアグラウンド状態の参加者とイベント発生者には通知が送信されないことを検証
    - テストファイル: `server/src/__tests__/pushService.test.ts`
    - **Validates: Requirements 6.1, 6.4, 7.1, 7.4**

  - [ ]* 3.7 PushService のプロパティテスト: Property 10 - 通知タグによるグループ化
    - **Property 10: 通知タグによるグループ化**
    - 同一 roomId のチャット通知が同一タグ `chat-${roomId}` を持つことを検証
    - テストファイル: `server/src/__tests__/pushService.test.ts`
    - **Validates: Requirements 6.5**

  - [x] 3.8 Push API ルートの実装 (`server/src/routes/push.ts`)
    - `GET /api/push/vapid-public-key`: VAPID 公開鍵を返す
    - `POST /api/push/subscribe`: 認証必須、Subscription を登録
    - `DELETE /api/push/subscribe`: 認証必須、Subscription を削除
    - `POST /api/push/invite`: 認証必須、ルーム招待通知を送信
    - リクエストバリデーションとエラーハンドリング
    - `server/src/index.ts` にルートをマウント
    - _Requirements: 3.3, 3.4, 3.5, 5.1, 5.2, 5.3_

- [x] 4. チェックポイント - サーバー側テスト確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. クライアント側 PWA 基盤
  - [x] 5.1 Vite PWA プラグインの設定
    - `vite-plugin-pwa` パッケージを `client` の devDependencies に追加
    - `client/vite.config.ts` に `VitePWA` プラグインを追加
    - Web App Manifest 設定（name, short_name, icons, theme_color, display, start_url, scope）
    - `injectManifest` モードで Service Worker カスタムロジックを統合
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.2 Service Worker カスタムロジックの実装 (`client/src/sw.ts`)
    - `push` イベントリスナー: ペイロード解析と `showNotification` 呼び出し
    - `notificationclick` イベントリスナー: 通知タップ時の URL ナビゲーション (`/web_rtc/room/${roomId}`)
    - 既存タブのフォーカスまたは新規タブの開設ロジック
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 5.3 PWA アイコンの配置
    - `client/public/icons/icon-192x192.png` と `client/public/icons/icon-512x512.png` を配置
    - _Requirements: 1.1, 1.4_

  - [ ]* 5.4 Manifest のプロパティテスト: Property 1 - Manifest 必須フィールド検証
    - **Property 1: Manifest 必須フィールド検証**
    - 任意の Manifest オブジェクトに対して必須フィールド（name, icons, theme_color, display, start_url, scope）が存在することを検証
    - テストファイル: `client/src/__tests__/manifest.test.ts`
    - **Validates: Requirements 1.1**

  - [ ]* 5.5 Service Worker のプロパティテスト: Property 2 - Push イベントから通知表示への変換
    - **Property 2: Push イベントから通知表示への変換**
    - 任意の有効な Push ペイロードに対して showNotification が正しく呼び出されることを検証
    - テストファイル: `client/src/__tests__/pushHandler.test.ts`
    - **Validates: Requirements 2.4**

  - [ ]* 5.6 Service Worker のプロパティテスト: Property 3 - 通知クリック時の正しい URL ナビゲーション
    - **Property 3: 通知クリック時の正しい URL ナビゲーション**
    - 任意の roomId を含む通知データに対して開く URL が `/web_rtc/room/${roomId}` と一致することを検証
    - テストファイル: `client/src/__tests__/pushHandler.test.ts`
    - **Validates: Requirements 2.5, 5.4, 6.3, 7.3**

- [x] 6. チェックポイント - PWA 基盤テスト確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. クライアント側フックと UI コンポーネント
  - [x] 7.1 usePushNotification フックの実装 (`client/src/hooks/usePushNotification.ts`)
    - `isSupported`: Push API サポート有無の判定
    - `permission`: 現在の通知許可状態
    - `isSubscribed`: 購読中かどうかの状態管理
    - `subscribe()`: PushManager.subscribe() → POST /api/push/subscribe
    - `unsubscribe()`: PushSubscription.unsubscribe() → DELETE /api/push/subscribe
    - Push API 非サポート時の graceful degradation
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 7.2 useVisibilityState フックの実装 (`client/src/hooks/useVisibilityState.ts`)
    - Page Visibility API による状態検出
    - Socket.IO 経由で `visibility-state` イベントを送信
    - `document.visibilityState` の変化を監視
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.3 NotificationPrompt コンポーネントの実装 (`client/src/components/NotificationPrompt.tsx`)
    - 通知許可が `default` 状態の時のみ表示
    - 「通知を有効にする」ボタンで `usePushNotification.subscribe()` を呼び出し
    - Push API 非サポート時は非表示
    - Dashboard に統合
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 7.4 InviteDialog コンポーネントの実装 (`client/src/components/InviteDialog.tsx`)
    - Dashboard のルームカードから「URL 共有」ボタン押下時に表示
    - 登録ユーザー一覧から送信先を選択
    - POST /api/push/invite で招待通知を送信
    - 送信結果（成功/失敗件数）を表示
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.5 ログアウト時の Subscription 削除
    - `AuthContext.tsx` のログアウト処理に Subscription 削除ロジックを追加
    - DELETE /api/push/subscribe を呼び出し
    - _Requirements: 3.7_

- [x] 8. Socket.IO イベント連携と通知トリガー統合
  - [x] 8.1 チャットメッセージ通知トリガーの統合
    - `server/src/index.ts` の `chat-message` イベントハンドラに PushService 呼び出しを追加
    - バックグラウンド状態の参加者にのみ通知送信
    - 送信者自身を除外
    - 通知タグ `chat-${roomId}` でグループ化
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 8.2 ユーザー入室通知トリガーの統合
    - `server/src/index.ts` の `join-room` イベントハンドラに PushService 呼び出しを追加
    - バックグラウンド状態の参加者にのみ通知送信
    - 入室者自身を除外
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 8.3 useVisibilityState フックの Room ページへの統合
    - `client/src/pages/RoomPage.tsx` に `useVisibilityState` フックを追加
    - ルーム参加時に visibility 状態の送信を開始
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.4 Service Worker 更新プロンプトの統合
    - `vite-plugin-pwa` の `useRegisterSW` フックを使用
    - 新しい Service Worker が利用可能な時にユーザーに更新を促す UI を表示
    - `client/src/App.tsx` または適切なレイアウトコンポーネントに統合
    - _Requirements: 2.2, 2.3_

- [x] 9. 最終チェックポイント - 全テスト確認
  - Ensure all tests pass, ask the user if questions arise.

## 備考

- `*` マーク付きのタスクはオプションであり、MVP では省略可能
- 各タスクは具体的な要件番号を参照しトレーサビリティを確保
- チェックポイントで段階的に動作確認を実施
- プロパティベーステストは `fast-check` を使用（クライアント・サーバー両方で devDependencies に追加済み）
- ユニットテストとプロパティテストは補完的に使用
