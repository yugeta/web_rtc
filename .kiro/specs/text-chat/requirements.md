# 要件定義書

## はじめに

WebRTCビデオ通話アプリケーションにテキストチャット機能を追加する。ビデオ通話中にリアルタイムでテキストメッセージを送受信できるようにし、チャット履歴をサーバー側でJSONLファイルに永続化する。メッセージの中継には既存のSocket.IO接続を利用し、WebRTC DataChannelは使用しない。ルーム内の全ユーザーが退出した時点でチャットログをgzip圧縮してアーカイブし、30日間の保持期間後に自動削除する。

## 用語集

- **Chat_Server**: Socket.IOベースのシグナリングサーバー（`server/src/index.ts`）にチャット機能を追加したサーバーコンポーネント
- **Chat_Panel**: クライアント側のチャットUIコンポーネント（`ChatPanel.tsx`）
- **Chat_Log_Manager**: チャットログファイルの書き込み・読み込み・アーカイブを管理するサーバー側モジュール
- **Archive_Scanner**: 期限切れアーカイブの定期削除を行うサーバー側プロセス
- **Chat_Message**: ユーザー名、メッセージ本文、タイムスタンプを含むチャットメッセージオブジェクト
- **Chat_Log_File**: ルームごとのJSONL形式チャットログファイル（`server/chat-logs/{roomId}.jsonl`）
- **Archive_File**: gzip圧縮されたチャットログファイル（`server/chat-logs/archive/room-{roomId}_{date}.jsonl.gz`）
- **Meta_Header**: Chat_Log_Fileの先頭行に記録されるメタデータ（`_meta`、`roomId`、`createdAt`を含む）
- **Room_User**: ルームに参加中のSocket.IO接続ユーザー

## 要件

### 要件 1: チャットメッセージの送信

**ユーザーストーリー:** ビデオ通話の参加者として、テキストメッセージを送信したい。音声では伝えにくい情報（URL、コードスニペット等）を共有するためである。

#### 受け入れ基準

1. WHEN Room_Userがメッセージ本文を入力して送信操作を行った場合、THE Chat_Panel SHALL `chat-message`イベントをSocket.IO経由でChat_Serverに送信する
2. THE Chat_Panel SHALL メッセージ本文が空文字または空白のみの場合に送信を無効化する
3. WHEN メッセージ送信が完了した場合、THE Chat_Panel SHALL 入力フィールドをクリアする
4. THE Chat_Message SHALL `userName`（文字列）、`message`（文字列）、`timestamp`（UNIXミリ秒）の3フィールドを含む

### 要件 2: チャットメッセージの受信と表示

**ユーザーストーリー:** ビデオ通話の参加者として、他の参加者が送信したメッセージをリアルタイムで受信・閲覧したい。会話の流れを把握するためである。

#### 受け入れ基準

1. WHEN Chat_Serverが`chat-message`イベントを受信した場合、THE Chat_Server SHALL 同一ルーム内の送信者を含む全Room_Userにメッセージをブロードキャストする
2. WHEN Chat_Panelが新しいChat_Messageを受信した場合、THE Chat_Panel SHALL メッセージをユーザー名、本文、タイムスタンプとともにチャット領域に表示する
3. WHEN 新しいメッセージが表示された場合、THE Chat_Panel SHALL チャット領域を最新メッセージの位置まで自動スクロールする
4. THE Chat_Panel SHALL 自分が送信したメッセージと他者が送信したメッセージを視覚的に区別して表示する

### 要件 3: チャットパネルのUI

**ユーザーストーリー:** ビデオ通話の参加者として、ビデオ通話画面を妨げずにチャットを利用したい。通話とチャットを同時に使うためである。

#### 受け入れ基準

1. THE Chat_Panel SHALL Room.tsxコンポーネント内にトグル可能なサイドパネルとして統合される
2. WHEN ユーザーがチャットトグルボタンを押した場合、THE Chat_Panel SHALL パネルの表示・非表示を切り替える
3. WHILE Chat_Panelが非表示の状態で新しいメッセージを受信した場合、THE Chat_Panel SHALL 未読メッセージ数をバッジとして表示する
4. WHEN Chat_Panelが表示された場合、THE Chat_Panel SHALL 未読メッセージ数のバッジをリセットする
5. THE Chat_Panel SHALL モバイル画面とデスクトップ画面の両方で適切に表示される

### 要件 4: チャットログの永続化

**ユーザーストーリー:** システム管理者として、チャット履歴をサーバー側に保存したい。トラブルシューティング時に参照するためである。

#### 受け入れ基準

1. WHEN ルームで最初のChat_Messageを受信した場合、THE Chat_Log_Manager SHALL `server/chat-logs/{roomId}.jsonl`にMeta_Headerを先頭行として書き込み、Chat_Log_Fileを作成する（`room-`プレフィックスは付けない）
2. THE Meta_Header SHALL `{"_meta":"header","roomId":"{roomId}","createdAt":{UNIXミリ秒}}`の形式に従う
3. WHEN Chat_Messageを受信した場合、THE Chat_Log_Manager SHALL `{"userName":"{名前}","message":"{本文}","timestamp":{UNIXミリ秒}}`の形式でChat_Log_Fileに1行追記する
4. THE Chat_Log_Manager SHALL 各メッセージをファイルに即座に追記し、メモリ上にバッファリングしない
5. IF Chat_Log_Fileへの書き込みに失敗した場合、THEN THE Chat_Log_Manager SHALL エラーをサーバーログに記録し、メッセージのリアルタイム配信は継続する

### 要件 5: 途中参加者へのチャット履歴提供

**ユーザーストーリー:** 途中からルームに参加したユーザーとして、参加前のチャット履歴を閲覧したい。会話の文脈を把握するためである。

#### 受け入れ基準

1. WHEN 新しいRoom_Userがルームに参加した場合、THE Chat_Server SHALL 該当ルームのChat_Log_Fileが存在すればファイルから過去のChat_Messageを読み込む
2. WHEN 過去のChat_Messageが存在する場合、THE Chat_Server SHALL `chat-history`イベントで参加者にメッセージ配列を送信する
3. WHEN Chat_Panelが`chat-history`イベントを受信した場合、THE Chat_Panel SHALL 過去のメッセージを時系列順にチャット領域に表示する
4. THE Chat_Server SHALL Chat_Log_FileのMeta_Header行を除外し、Chat_Messageのみを`chat-history`として送信する

### 要件 6: チャットログのアーカイブ

**ユーザーストーリー:** システム管理者として、使用済みのチャットログを圧縮保存したい。ディスク容量を節約しつつ履歴を保持するためである。

#### 受け入れ基準

1. WHEN ルーム内の全Room_Userが退出した場合、THE Chat_Log_Manager SHALL 該当ルームのChat_Log_Fileをgzip圧縮する
2. WHEN gzip圧縮が完了した場合、THE Chat_Log_Manager SHALL 圧縮ファイルを`server/chat-logs/archive/{roomId}.{YYYYMMDD}.jsonl.gz`に移動する
3. WHEN アーカイブが完了した場合、THE Chat_Log_Manager SHALL 元のChat_Log_Fileを削除する
4. IF アーカイブ処理中にエラーが発生した場合、THEN THE Chat_Log_Manager SHALL エラーをサーバーログに記録し、元のChat_Log_Fileを保持する

### 要件 7: アーカイブの自動削除

**ユーザーストーリー:** システム管理者として、古いアーカイブを自動削除したい。サーバーのディスク容量を管理するためである。

#### 受け入れ基準

1. THE Archive_Scanner SHALL サーバー起動時にアーカイブディレクトリのスキャンを実行する
2. THE Archive_Scanner SHALL 1時間ごとにアーカイブディレクトリのスキャンを定期実行する
3. WHEN スキャン実行時、THE Archive_Scanner SHALL 作成日から30日を超過したArchive_Fileを削除する
4. THE Archive_Scanner SHALL アクティブなChat_Log_File（`server/chat-logs/`直下のファイル）を操作対象から除外する
5. IF Archive_Fileの削除に失敗した場合、THEN THE Archive_Scanner SHALL エラーをサーバーログに記録し、次回スキャンまで該当ファイルの削除を延期する

### 要件 8: JSONL形式のパース・整形

**ユーザーストーリー:** 開発者として、JSONL形式のチャットログを正確にパース・整形したい。データの整合性を保証するためである。

#### 受け入れ基準

1. THE Chat_Log_Manager SHALL Chat_Log_Fileの各行を独立したJSONオブジェクトとしてパースする
2. THE Chat_Log_Manager SHALL Chat_Messageオブジェクトを有効なJSON文字列に整形してChat_Log_Fileに書き込む
3. FOR ALL 有効なChat_Messageオブジェクトに対して、整形してからパースした結果は元のオブジェクトと等価である（ラウンドトリップ特性）
4. IF Chat_Log_Fileの読み込み中に不正なJSON行を検出した場合、THEN THE Chat_Log_Manager SHALL 該当行をスキップし、エラーをサーバーログに記録し、残りの行のパースを継続する
