# 要件定義書: 画面共有機能

## はじめに

WebRTC Meetアプリケーションに画面共有機能を追加する。参加者はビデオ通話中に自分のデスクトップ、アプリケーションウィンドウ、またはブラウザタブを他の参加者と共有できる。画面共有はWebRTCのP2P接続を活用し、既存のsimple-peer + Socket.IO + DataChannelアーキテクチャに統合する。

## 用語集

- **Screen_Share_Stream**: `getDisplayMedia()` APIで取得した画面共有用のMediaStream
- **Room_Component**: ビデオ通話のメインコンポーネント（Room.tsx）
- **Sharing_User**: 画面共有を開始した参加者
- **Receiving_User**: 画面共有を受信している参加者
- **Controls_Bar**: ルーム画面下部の操作ボタン群
- **Screen_Share_Button**: 画面共有の開始・停止を切り替えるボタン
- **Video_Grid**: 参加者のビデオを表示するグリッドレイアウト
- **DataChannel**: WebRTCのデータチャネル（トラック状態の通知に使用）
- **Peer_Connection**: simple-peerで管理されるWebRTCのP2P接続

## 要件

### 要件 1: 画面共有の開始

**ユーザーストーリー:** 参加者として、ビデオ通話中に自分の画面を共有したい。他の参加者に資料やアプリケーションを見せるためである。

#### 受け入れ基準

1. WHEN Sharing_User が Screen_Share_Button をクリックした場合、THE Room_Component SHALL ブラウザの `getDisplayMedia()` APIを呼び出し、画面選択ダイアログを表示する
2. WHEN Sharing_User が画面選択ダイアログで共有対象を選択した場合、THE Room_Component SHALL Screen_Share_Stream を取得し、全ての Peer_Connection に対して画面共有トラックを追加する
3. WHEN 画面共有が開始された場合、THE Room_Component SHALL DataChannel を通じて全ての Receiving_User に画面共有開始の通知を送信する
4. WHEN 画面共有が開始された場合、THE Screen_Share_Button SHALL アクティブ状態（共有中）の視覚的フィードバックを表示する

### 要件 2: 画面共有の停止

**ユーザーストーリー:** 参加者として、画面共有を任意のタイミングで停止したい。共有が不要になった際にプライバシーを保護するためである。

#### 受け入れ基準

1. WHEN Sharing_User が Screen_Share_Button を再度クリックした場合、THE Room_Component SHALL Screen_Share_Stream の全トラックを停止し、Peer_Connection から画面共有トラックを削除する
2. WHEN Sharing_User がブラウザの「共有を停止」ボタンをクリックした場合、THE Room_Component SHALL Screen_Share_Stream の `track.onended` イベントを検知し、画面共有を自動的に停止する
3. WHEN 画面共有が停止された場合、THE Room_Component SHALL DataChannel を通じて全ての Receiving_User に画面共有停止の通知を送信する
4. WHEN 画面共有が停止された場合、THE Screen_Share_Button SHALL 非アクティブ状態（未共有）の表示に戻る

### 要件 3: 画面共有の受信と表示

**ユーザーストーリー:** 参加者として、他の参加者が共有した画面を見たい。共有された資料やアプリケーションを確認するためである。

#### 受け入れ基準

1. WHEN Receiving_User が画面共有開始の通知を DataChannel 経由で受信した場合、THE Video_Grid SHALL 画面共有用の表示領域を追加する
2. WHEN 画面共有ストリームを受信した場合、THE Video_Grid SHALL 画面共有映像を他の参加者のカメラ映像と区別できる形式で表示する
3. THE Video_Grid SHALL 画面共有映像に Sharing_User の名前と「画面共有」ラベルを表示する
4. WHEN 画面共有停止の通知を受信した場合、THE Video_Grid SHALL 画面共有用の表示領域を削除し、通常のグリッドレイアウトに戻る

### 要件 4: 画面共有中のカメラ映像の維持

**ユーザーストーリー:** 参加者として、画面共有中もカメラ映像を維持したい。画面を共有しながら顔を見せてコミュニケーションを続けるためである。

#### 受け入れ基準

1. WHILE 画面共有が有効な間、THE Room_Component SHALL Sharing_User のカメラ映像ストリームを維持し、Peer_Connection 経由で送信し続ける
2. WHILE 画面共有が有効な間、THE Room_Component SHALL Sharing_User のマイク音声ストリームを維持し、Peer_Connection 経由で送信し続ける
3. WHILE 画面共有が有効な間、THE Controls_Bar SHALL マイクとカメラのオン・オフ切り替え機能を引き続き利用可能にする

### 要件 5: 画面共有の排他制御

**ユーザーストーリー:** 参加者として、同時に1人だけが画面共有できるようにしたい。複数の画面共有が同時に行われると混乱するためである。

#### 受け入れ基準

1. WHILE 別の参加者が画面共有中である間、THE Screen_Share_Button SHALL 無効化状態で表示し、他の参加者が画面共有を開始できないようにする
2. WHEN 別の参加者が画面共有を開始した通知を受信した場合、THE Room_Component SHALL Screen_Share_Button を無効化し、ツールチップで「他の参加者が画面共有中です」と表示する
3. WHEN 画面共有中の参加者が共有を停止した場合、THE Room_Component SHALL 全参加者の Screen_Share_Button を有効化状態に戻す

### 要件 6: 画面共有中の参加者の退出処理

**ユーザーストーリー:** 参加者として、画面共有中のユーザーが退出した場合に適切にクリーンアップしたい。UIが壊れた状態にならないためである。

#### 受け入れ基準

1. WHEN Sharing_User がルームから退出した場合、THE Room_Component SHALL 画面共有用の表示領域を削除し、通常のグリッドレイアウトに戻る
2. WHEN Sharing_User がルームから退出した場合、THE Room_Component SHALL 全参加者の Screen_Share_Button を有効化状態に戻す
3. WHEN Sharing_User のネットワーク接続が切断された場合、THE Room_Component SHALL 画面共有の停止と同じクリーンアップ処理を実行する

### 要件 7: エラーハンドリング

**ユーザーストーリー:** 参加者として、画面共有に失敗した場合に適切なフィードバックを受けたい。問題の原因を理解し対処するためである。

#### 受け入れ基準

1. IF Sharing_User が画面選択ダイアログをキャンセルした場合、THEN THE Room_Component SHALL エラーを表示せず、画面共有開始前の状態を維持する
2. IF `getDisplayMedia()` APIがブラウザでサポートされていない場合、THEN THE Screen_Share_Button SHALL 非表示にする
3. IF 画面共有ストリームの取得中にエラーが発生した場合、THEN THE Room_Component SHALL ユーザーに「画面共有の開始に失敗しました」というメッセージを表示する
4. IF 画面共有中に Peer_Connection へのトラック追加が失敗した場合、THEN THE Room_Component SHALL Screen_Share_Stream を停止し、エラーメッセージを表示する

### 要件 8: UIコントロール

**ユーザーストーリー:** 参加者として、画面共有の操作が直感的に行えるUIを使いたい。既存のコントロールバーと一貫性のある操作体験のためである。

#### 受け入れ基準

1. THE Controls_Bar SHALL Screen_Share_Button をカメラボタンとスピーカーボタンの間に配置する
2. THE Screen_Share_Button SHALL 画面共有を示すアイコン（Monitor/ScreenShare）を使用する
3. WHEN 画面共有が有効な場合、THE Screen_Share_Button SHALL 既存のミュートボタンと同じアクティブ状態のスタイルを適用する
4. THE Screen_Share_Button SHALL ホバー時に「画面を共有」または「共有を停止」のツールチップを表示する
