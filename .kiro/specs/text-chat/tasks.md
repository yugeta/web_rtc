# 実装計画: テキストチャット機能

## 概要

既存のWebRTCビデオ通話アプリにSocket.IOサーバーリレー方式のテキストチャット機能を追加する。サーバー側でJSONLログ永続化・gzipアーカイブ・自動削除を実装し、クライアント側にトグル式サイドパネルUIを追加する。

## タスク

- [x] 1. サーバー側のチャットログ管理モジュールを実装する
  - [x] 1.1 `server/src/chatLogManager.ts`を作成し、ChatMessage型・MetaHeader型・ディレクトリ確保関数を定義する
    - `ChatMessage`インターフェース（userName, message, timestamp）を定義
    - `MetaHeader`インターフェース（_meta, roomId, createdAt）を定義
    - `ensureDirectories()`で`server/chat-logs/`と`server/chat-logs/archive/`を再帰的に作成
    - _要件: 1.4, 4.1, 4.2_

  - [x] 1.2 `serializeMessage`と`parseMessage`関数を実装する
    - `serializeMessage`: ChatMessageをJSON文字列に変換
    - `parseMessage`: JSON文字列をパースし、不正な行はnullを返してconsole.warnでログ出力
    - _要件: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.3 Property 1のプロパティテストを作成する（ChatMessageシリアライズのラウンドトリップ）
    - **Property 1: ChatMessageシリアライズのラウンドトリップ**
    - `server/src/__tests__/chatLogManager.test.ts`にテストを追加
    - fast-checkで任意のChatMessageを生成し、serializeMessage→parseMessageの結果が元と等価であることを検証
    - **検証対象: 要件 8.3, 8.1, 8.2, 1.4**

  - [x] 1.4 `appendMessage`関数を実装する
    - ファイル未存在時にMetaHeaderを先頭行として書き込み後、メッセージを追記
    - ファイル存在時はメッセージのみ追記（`fs.appendFileSync`）
    - 書き込み失敗時は`console.error`でログ出力し例外を握りつぶす
    - _要件: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.5 Property 8のプロパティテストを作成する（初回メッセージでメタヘッダー付きファイル作成）
    - **Property 8: 初回メッセージでメタヘッダー付きファイルが作成される**
    - fast-checkで任意のroomIdとChatMessageを生成し、appendMessage後のファイル先頭行が正しいMetaHeaderであることを検証
    - **検証対象: 要件 4.1, 4.2**

  - [x] 1.6 Property 9のプロパティテストを作成する（追記メッセージ数の不変条件）
    - **Property 9: 追記メッセージ数の不変条件**
    - fast-checkで任意のN件のChatMessageを生成し、appendMessage後の非メタヘッダー行数がNと等しいことを検証
    - **検証対象: 要件 4.3**

  - [x] 1.7 `getHistory`関数を実装する
    - Chat_Log_Fileを読み込み、MetaHeader行（`_meta`フィールド有り）を除外
    - 不正なJSON行はスキップし`console.warn`でログ出力
    - ファイル不在時は空配列を返す
    - _要件: 5.1, 5.3, 5.4, 8.4_

  - [x] 1.8 Property 10のプロパティテストを作成する（getHistoryのフィルタリングと順序）
    - **Property 10: getHistoryはメタヘッダーを除外し時系列順でChatMessageのみを返す**
    - fast-checkでMetaHeaderとN件のChatMessageが書き込まれたファイルに対し、getHistoryがN件のChatMessageのみを返すことを検証
    - **検証対象: 要件 5.1, 5.3, 5.4**

  - [x] 1.9 Property 13のプロパティテストを作成する（不正JSON行のスキップ）
    - **Property 13: 不正なJSON行はスキップされ有効な行のみが返される**
    - fast-checkで有効なJSON行と不正なJSON行が混在するファイルを生成し、getHistoryが有効なChatMessageのみを返すことを検証
    - **検証対象: 要件 8.4**

  - [x] 1.10 `archiveLog`関数を実装する
    - Chat_Log_Fileを読み込み、gzip圧縮して`server/chat-logs/archive/{roomId}.{YYYYMMDD}.jsonl.gz`に保存
    - 圧縮完了後に元ファイルを削除
    - エラー発生時は`console.error`でログ出力し、元ファイルを保持
    - _要件: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.11 Property 11のプロパティテストを作成する（アーカイブ処理の完全性）
    - **Property 11: アーカイブ処理の完全性**
    - fast-checkで任意のChat_Log_Fileに対し、archiveLog後にarchive/に.jsonl.gzが作成され、展開内容が元と等価で、元ファイルが削除されることを検証
    - **検証対象: 要件 6.1, 6.2, 6.3**

- [x] 2. チェックポイント - サーバー側チャットログ管理モジュール
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. アーカイブスキャナーモジュールを実装する
  - [x] 3.1 `server/src/archiveScanner.ts`を作成し、`scanAndCleanup`関数を実装する
    - `server/chat-logs/archive/`ディレクトリをスキャンし、ファイル名から日付を抽出
    - 作成日から30日超過したファイルを削除
    - `server/chat-logs/`直下のアクティブログファイルは操作対象外
    - 削除失敗時は`console.error`でログ出力し、次回スキャンまで延期
    - _要件: 7.3, 7.4, 7.5_

  - [x] 3.2 `startScheduler`関数を実装する
    - サーバー起動時に初回スキャンを実行
    - `setInterval`で1時間ごとに定期スキャンを実行
    - _要件: 7.1, 7.2_

  - [x] 3.3 Property 12のプロパティテストを作成する（期限切れアーカイブのみ削除）
    - **Property 12: Archive Scannerは期限切れアーカイブのみを削除する**
    - `server/src/__tests__/archiveScanner.test.ts`にテストを追加
    - fast-checkで30日超過・30日以内のアーカイブファイルを混在生成し、scanAndCleanup後に超過ファイルのみ削除されることを検証
    - **検証対象: 要件 7.3, 7.4**

- [x] 4. サーバーのSocket.IOイベントハンドラにチャット機能を統合する
  - [x] 4.1 `server/src/index.ts`にchatLogManagerとarchiveScannerをインポートし、起動時に`ensureDirectories()`と`startScheduler()`を呼び出す
    - _要件: 7.1_

  - [x] 4.2 `chat-message`イベントハンドラを追加する
    - `socketRoomMap`からユーザー情報を取得
    - ChatMessageオブジェクトを構築（userName, message, timestamp: Date.now()）
    - `appendMessage`でログ永続化
    - `io.to(roomId).emit('chat-message', chatMessage)`でルーム全体にブロードキャスト
    - _要件: 1.1, 2.1, 4.3_

  - [x] 4.3 `join-room`ハンドラ内にチャット履歴送信を追加する
    - `getHistory(roomId)`で過去メッセージを取得
    - 履歴が存在すれば`socket.emit('chat-history', history)`で送信
    - _要件: 5.1, 5.2_

  - [x] 4.4 `disconnect`ハンドラ内にアーカイブ処理を追加する
    - `roomUsers[roomId]?.length === 0`の分岐内で`archiveLog(roomId)`を呼び出す
    - _要件: 6.1_

- [x] 5. チェックポイント - サーバー側統合
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 6. クライアント側のChatPanelコンポーネントを実装する
  - [x] 6.1 `client/src/components/ChatPanel.tsx`を作成し、基本構造を実装する
    - ChatPanelProps（socket, userName, isOpen, onUnreadCountChange）を定義
    - ChatMessage型を定義
    - メッセージ一覧の表示領域と入力フォームのレイアウトを実装
    - 自分のメッセージと他者のメッセージを視覚的に区別するスタイルを適用
    - _要件: 2.2, 2.4, 3.1, 3.5_

  - [x] 6.2 メッセージ送信機能を実装する
    - 空白のみのメッセージは送信を無効化（trim後に空文字チェック）
    - `socket.emit('chat-message', { message })`で送信
    - 送信後に入力フィールドをクリア
    - _要件: 1.1, 1.2, 1.3_

  - [x] 6.3 メッセージ受信・履歴表示機能を実装する
    - `chat-message`イベントリスナーで新規メッセージを追加
    - `chat-history`イベントリスナーで過去メッセージを一括表示
    - 新メッセージ受信時に自動スクロール
    - _要件: 2.2, 2.3, 5.3_

  - [x] 6.4 未読メッセージカウント機能を実装する
    - パネル非表示時に受信したメッセージ数をカウント
    - `onUnreadCountChange`コールバックで親コンポーネントに通知
    - パネル表示時にカウントをリセット
    - _要件: 3.3, 3.4_

  - [x] 6.5 Property 2のプロパティテストを作成する（空白メッセージの送信拒否）
    - **Property 2: 空白文字のみのメッセージは送信拒否される**
    - `client/src/components/__tests__/ChatPanel.test.tsx`にテストを追加
    - fast-checkで空白文字のみの文字列を生成し、送信操作後にchat-messageイベントが発火しないことを検証
    - **検証対象: 要件 1.2**

  - [x] 6.6 Property 3のプロパティテストを作成する（送信後の入力フィールドクリア）
    - **Property 3: 送信後に入力フィールドがクリアされる**
    - fast-checkで有効なメッセージ文字列を生成し、送信後に入力フィールドが空であることを検証
    - **検証対象: 要件 1.3**

  - [x] 6.7 Property 5のプロパティテストを作成する（メッセージ表示の情報完全性と送信者区別）
    - **Property 5: メッセージ表示に必要な情報が含まれ、送信者が区別される**
    - fast-checkで任意のChatMessageとカレントユーザー名を生成し、表示にuserName・message・timestampが含まれ、送信者の場合は異なるスタイルが適用されることを検証
    - **検証対象: 要件 2.2, 2.4**

  - [x] 6.8 Property 6のプロパティテストを作成する（チャットパネルのトグル冪等性）
    - **Property 6: チャットパネルのトグル動作**
    - fast-checkで任意の初期表示状態を生成し、トグル2回で元の状態に戻ることを検証
    - **検証対象: 要件 3.2**

  - [x] 6.9 Property 7のプロパティテストを作成する（未読カウントの正確性）
    - **Property 7: パネル非表示時の未読カウント**
    - fast-checkでパネル非表示状態でN件のメッセージを受信し、未読カウントがNと等しいことを検証
    - **検証対象: 要件 3.3**

- [x] 7. Room.tsxにChatPanelを統合する
  - [x] 7.1 Room.tsxにチャット関連のStateとトグルボタンを追加する
    - `isChatOpen`と`unreadCount`のStateを追加
    - コントロールバーにチャットトグルボタンを追加（`MessageSquare`アイコン、lucide-react）
    - 未読バッジの表示
    - _要件: 3.1, 3.2, 3.3_

  - [x] 7.2 ChatPanelコンポーネントをRoom.tsx内に配置する
    - ビデオグリッドの右側にサイドパネルとして配置
    - `socketRef.current`をChatPanelに渡す
    - モバイル・デスクトップ両対応のレスポンシブレイアウト
    - _要件: 3.1, 3.5_

- [x] 8. 最終チェックポイント - 全テスト通過確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*`マーク付きのタスクはオプションであり、MVP優先時にスキップ可能
- 各タスクは具体的な要件番号を参照しトレーサビリティを確保
- チェックポイントでインクリメンタルな検証を実施
- プロパティテストは設計書の正当性プロパティに基づく普遍的な検証
- ユニットテストは具体的な例とエッジケースの検証
