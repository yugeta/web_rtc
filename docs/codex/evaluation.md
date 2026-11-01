# Codex Evaluation

## 総評

このプロジェクトは、かなり機能を詰めた実用プロトタイプです。WebRTC/Socket.IO/Google OAuth/Room 管理/PWA push/管理画面まで、会議アプリに必要な部品は一通り揃っています。

一方で、現状はクライアントにマージコンフリクトが残っており、テストやビルド以前にパースで落ちる状態です。また、本番運用を考えると Socket.IO の認可、入力検証、ファイル永続化まわりに優先度の高いリスクがあります。

評価としては、「方向性と機能量は良い。ただし現状はクライアントが壊れていて、本番運用にはまだ危ない」です。

## 良い点

- WebRTC による P2P 通話、Socket.IO によるシグナリング、Google OAuth、JWT、Room 管理、チャット、画面共有、PWA push、管理画面まで機能範囲が広い。
- サーバ側は `roomStore`、`chatLogManager`、`pushService` などに責務が分かれており、比較的読みやすい。
- ドキュメントが用意されており、構成・デプロイ・PWA・トラブルシュートまで残されている。
- サーバ側のテストと型チェックは通っている。

## 重大な問題

### クライアントにマージコンフリクトが残っている

`client/src/hooks/usePushNotification.ts` と `client/src/pages/Dashboard.tsx` に `<<<<<<< HEAD` などのコンフリクトマーカーが残っています。

このため、現状のクライアントは `npm test` も `npm run lint` も失敗します。まずここを直さないと、アプリとしての評価や検証が進めにくい状態です。

### Socket.IO 側の認可が弱い

`server/src/index.ts` の `join-room` は、クライアントから送られた `roomId` をそのまま受け取り、Room の存在確認や参加権限確認をしていません。

クライアント側では Room 存在チェックをしていますが、Socket.IO を直接叩けば存在しない部屋にも参加できます。Room が削除済みでも、Socket レイヤでは参加できる可能性があります。

### シグナリングがクライアント申告を信用しすぎている

`signal` イベントでは、`caller` と `target` をクライアント申告のまま使っています。同じ Room の参加者か、送信元 socket と `caller` が一致しているか、といった検証がありません。

このため、別 socket への不正なシグナル送信や、なりすましに近い挙動を許す余地があります。

### `roomId` をファイルパスに使っている

`chatLogManager.ts` では `${roomId}.jsonl` をそのまま `path.join` してチャットログのファイル名にしています。

Socket 側で任意の `roomId` を受け付けているため、パストラバーサル系のファイル書き込みリスクがあります。UUID 形式などの厳格なバリデーションが必要です。

## 設計・保守性の問題

### `Room.tsx` が大きすぎる

`client/src/components/Room.tsx` に、メディア取得、Socket 接続、Peer 管理、DataChannel、画面共有、デバイス切替、チャット表示制御、UI 状態が集まっています。

WebRTC はもともと非同期イベントが多いため、この密度だと不具合の原因追跡が難しくなります。将来的には、少なくとも以下のような責務に分けると保守しやすくなります。

- ローカルメディア管理
- Socket.IO シグナリング
- Peer 接続管理
- 画面共有
- デバイス切替
- Room UI

### React hooks の依存関係が危うい

`Room.tsx` の初期化 effect は `roomId` のみに依存していますが、中で `userName`、`initialSettings`、`createPeer`、`addPeer` などを参照しています。

lint でも hooks 依存や関数宣言順に関する警告/エラーが出ています。現在はたまたま動いていても、再レンダリングや props 変更時に古い値を掴む可能性があります。

### 永続化が同期 JSON ファイルに寄っている

`roomStore.ts` や `subscriptionStore.ts` は、読み書きごとに同期 I/O と全件 JSON parse/write を行っています。

小規模なら単純で扱いやすいですが、同時更新、ファイル破損、プロセス複数化、データ量増加に弱いです。本番運用するなら SQLite、PostgreSQL、Redis などへの移行を検討した方が安全です。

### CORS が広い

サーバの CORS が `origin: '*'` になっています。公開 API としては広すぎます。

認証付き API、push、admin API を持っているため、本番では許可 origin を明示した方が良いです。

## 検証結果

実行時点での結果です。

- `server npm test`: passed
- `server npx tsc --noEmit`: passed
- `client npm test`: failed
- `client npm run lint`: failed

クライアントの失敗原因として特に大きいものは、マージコンフリクトマーカーです。その他にも hooks 依存、`any`、React 19 系 lint ルール、Fast Refresh ルールなどで複数の問題が出ています。

## 優先順位

1. クライアントのマージコンフリクトを解消する。
2. `roomId` のバリデーションを入れる。UUID 形式など、想定外の文字列を拒否する。
3. Socket.IO の `join-room` で Room 存在確認を行う。
4. `signal` で送信元 socket、caller、target、room 所属を検証する。
5. チャットメッセージやユーザー名の長さ制限、型検証を入れる。
6. `Room.tsx` を責務ごとに分割する。
7. ファイル永続化を、本番運用に耐えるストレージへ移行する。
8. CORS、レート制限、ログの個人情報取り扱いを本番向けに締める。

## まとめ

このプロジェクトは、方向性はかなり良いです。単なるサンプルではなく、実際に使う会議アプリとして必要な機能を積み上げようとしているのが見えます。

ただし、現在はクライアントがビルド不能な状態で、加えて Socket.IO とファイルパスまわりにセキュリティ上の弱点があります。まずは「動く状態へ戻す」、次に「信頼境界を固める」、その後に「大きくなった Room 実装を分割する」という順番が自然です。
