# 実装計画: 画面共有機能

## 概要

WebRTC Meetアプリケーションに画面共有機能を追加する。Room.tsxを拡張し、`getDisplayMedia()` APIによる画面共有ストリームの取得・配信、DataChannelによる状態通知、排他制御、UIコントロールを実装する。サーバー側の変更は不要。

## タスク

- [x] 1. Room.tsxの画面共有State・型定義・ヘルパー関数を追加
  - [x] 1.1 PeerDataインターフェースに`screenStream`フィールドを追加し、DataChannelメッセージ型に`screen-share`タイプを追加する
    - `screenStream?: MediaStream` をPeerDataに追加
    - `DataChannelMessage`型を定義（`status` | `screen-share`）
    - _Requirements: 1.2, 1.3, 3.1_
  - [x] 1.2 画面共有関連のState（`screenStream`, `isScreenSharing`, `screenSharingUserId`, `screenSharingUserName`）とRefを追加する
    - `getDisplayMedia`のサポート検出（`isScreenShareSupported`）も追加
    - _Requirements: 1.4, 5.1, 7.2_
  - [x] 1.3 `broadcastScreenShareStatus()`関数を実装する
    - 全Peerに対してDataChannelで画面共有状態を送信
    - _Requirements: 1.3, 2.3_
  - [ ]* 1.4 プロパティテスト: DataChannel画面共有通知のブロードキャスト
    - **Property 2: DataChannel 画面共有通知のブロードキャスト**
    - **Validates: Requirements 1.3, 2.3**

- [x] 2. 画面共有の開始・停止ロジックを実装
  - [x] 2.1 `startScreenShare()`関数を実装する
    - `getDisplayMedia()`でストリーム取得
    - `track.onended`でブラウザの「共有を停止」ボタンに対応
    - 全Peerに`addTrack()`で画面共有トラックを追加
    - DataChannelで開始通知を送信
    - キャンセル時（`NotAllowedError`/`AbortError`）はエラーを表示しない
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 7.1, 7.3, 7.4_
  - [x] 2.2 `stopScreenShare()`関数を実装する
    - 全トラックを停止し、全Peerから`removeTrack()`で削除
    - DataChannelで停止通知を送信
    - State をリセット
    - _Requirements: 2.1, 2.3, 2.4_
  - [ ]* 2.3 プロパティテスト: 画面共有トラックのラウンドトリップ
    - **Property 1: 画面共有トラックのラウンドトリップ**
    - **Validates: Requirements 1.2, 2.1**
  - [ ]* 2.4 プロパティテスト: 画面共有中のカメラ・マイクストリーム維持
    - **Property 4: 画面共有中のカメラ・マイクストリーム維持**
    - **Validates: Requirements 4.1, 4.2**

- [x] 3. チェックポイント - 画面共有の開始・停止ロジックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. DataChannelメッセージハンドラとストリーム受信の拡張
  - [x] 4.1 `createPeer()`と`addPeer()`内のDataChannelハンドラに`screen-share`メッセージの処理を追加する
    - `sharing: true`受信時: `screenSharingUserId`と`screenSharingUserName`を設定
    - `sharing: false`受信時: 画面共有状態をクリアし、Peerの`screenStream`を削除
    - _Requirements: 3.1, 3.4, 5.1, 5.2_
  - [x] 4.2 `peer.on('stream')`ハンドラを拡張し、画面共有ストリームとカメラストリームを区別する
    - 音声トラックがなく映像トラックのみのストリームを画面共有として判定
    - `screenStream`としてPeerDataに保存
    - _Requirements: 3.1, 3.2_
  - [x] 4.3 `user-disconnected`イベントハンドラを拡張し、画面共有中ユーザーの退出時にクリーンアップする
    - `screenSharingUserId`が退出ユーザーと一致する場合、画面共有状態をリセット
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. UIコンポーネントの実装
  - [x] 5.1 ScreenShareViewコンポーネントを新規作成する
    - 画面共有映像を表示する`<video>`要素
    - ユーザー名と「画面共有」ラベルを表示
    - CSSクラス`screen-share-wrapper`と`screen-share-label`を使用
    - _Requirements: 3.2, 3.3_
  - [x] 5.2 Controls_BarにScreenShareButtonを追加する
    - カメラボタンとスピーカーボタンの間に配置
    - `Monitor`アイコン（lucide-react）を使用
    - `isScreenShareSupported`が`false`の場合は非表示
    - `screenSharingUserId`が他ユーザーの場合は無効化+ツールチップ
    - アクティブ状態は既存のミュートボタンと同じスタイル
    - _Requirements: 7.2, 8.1, 8.2, 8.3, 8.4, 5.1, 5.2, 5.3_
  - [ ]* 5.3 プロパティテスト: 画面共有ラベルにユーザー名を表示
    - **Property 3: 画面共有ラベルにユーザー名を表示**
    - **Validates: Requirements 3.3**
  - [ ]* 5.4 プロパティテスト: 画面共有ボタンの排他制御
    - **Property 5: 画面共有ボタンの排他制御**
    - **Validates: Requirements 5.1, 5.3, 6.2**
  - [ ]* 5.5 プロパティテスト: getDisplayMedia非対応時のボタン非表示
    - **Property 6: getDisplayMedia非対応時のボタン非表示**
    - **Validates: Requirements 7.2**
  - [ ]* 5.6 プロパティテスト: ツールチップの状態反映
    - **Property 7: ツールチップの状態反映**
    - **Validates: Requirements 8.4**

- [x] 6. Video_Gridレイアウトの拡張とCSS追加
  - [x] 6.1 Video_Gridに画面共有表示を統合する
    - 画面共有中はScreenShareViewを上部に大きく表示し、カメラ映像を下部に小さく並べるレイアウト
    - 自分の画面共有時はローカルの`screenStream`を表示、他者の場合はPeerの`screenStream`を表示
    - 画面共有停止時は通常のグリッドレイアウトに戻る
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 6.2 画面共有関連のCSSスタイルを追加する
    - `.screen-share-wrapper`, `.screen-share-label`のスタイル定義
    - 画面共有中のVideo_Gridレイアウト調整
    - _Requirements: 3.2, 8.3_

- [x] 7. 画面共有中のカメラ・マイク操作の維持確認
  - [x] 7.1 画面共有中もtoggleAudio/toggleVideoが正常に動作することを確認し、必要に応じて修正する
    - 画面共有トラックがカメラ/マイクトラックに影響しないことを保証
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. 最終チェックポイント - 全機能の統合確認
  - Ensure all tests pass, ask the user if questions arise.

## 備考

- `*` マーク付きのタスクはオプションで、MVP実装時にはスキップ可能
- 各タスクは要件番号を参照しトレーサビリティを確保
- チェックポイントで段階的に動作確認を実施
- プロパティテストは設計ドキュメントの正当性プロパティを検証
- サーバー側の変更は不要（DataChannelでP2P通信）
