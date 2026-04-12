# 要件ドキュメント: PWA プッシュ通知

## はじめに

本機能は、既存のビデオ会議 Web アプリケーションを PWA（Progressive Web App）化し、Web Push API を利用したプッシュ通知機能を追加するものである。これにより、ユーザーはスマートフォンやデスクトップにアプリをインストールし、ブラウザを閉じていてもルームへの招待やチャットメッセージなどの通知を受け取れるようになる。

### 技術的アプローチ

- **Service Worker**: Vite PWA プラグイン（`vite-plugin-pwa`）を使用し、Service Worker を自動生成・登録する
- **Web Push API**: サーバー側で `web-push` ライブラリを使用し、VAPID 認証によるプッシュ通知を送信する
- **Push Subscription**: クライアント側で `PushManager.subscribe()` を使用し、ブラウザのプッシュ通知購読を管理する
- **Web App Manifest**: `manifest.json` を設定し、ホーム画面への追加（A2HS）を可能にする

### 期待される挙動

1. **インストール**: ユーザーがブラウザのアドレスバーまたはアプリ内バナーから「ホーム画面に追加」できる
2. **通知許可**: ログイン後、通知の許可を求めるプロンプトが表示される
3. **プッシュ通知受信**: アプリを閉じていても、以下のイベントで通知が届く
   - ルームへの招待リンクが共有された時
   - 参加中のルームに新しいチャットメッセージが届いた時（バックグラウンド時のみ）
   - 参加中のルームに新しいユーザーが入室した時（バックグラウンド時のみ）
4. **通知タップ**: 通知をタップすると、該当のルームが開く

## 用語集

- **PWA_App**: Progressive Web App として動作する本ビデオ会議アプリケーション
- **Service_Worker**: ブラウザのバックグラウンドで動作し、プッシュ通知の受信やオフラインキャッシュを担当するスクリプト
- **Push_Subscription**: ブラウザがプッシュサーバーから通知を受け取るための購読情報（エンドポイント URL と暗号鍵を含む）
- **VAPID_Key**: Voluntary Application Server Identification の鍵ペア。サーバーがプッシュサービスに対して自身を証明するために使用する
- **Notification_Server**: Express サーバー上のプッシュ通知送信を担当するモジュール
- **Web_App_Manifest**: PWA のメタデータ（名前、アイコン、テーマカラー等）を定義する JSON ファイル

## 要件

### 要件 1: Web App Manifest とインストール可能性

**ユーザーストーリー:** ルーム管理者として、Web アプリをスマートフォンのホーム画面に追加したい。ネイティブアプリのようにすぐアクセスできるようにするため。

#### 受け入れ基準

1. THE PWA_App SHALL Web_App_Manifest を提供し、アプリ名、アイコン（192x192 および 512x512）、テーマカラー、表示モード（standalone）を含める
2. WHEN ユーザーが対応ブラウザで PWA_App にアクセスした時、THE PWA_App SHALL ブラウザのインストールプロンプト（A2HS）を有効にする
3. WHEN ユーザーがホーム画面から PWA_App を起動した時、THE PWA_App SHALL standalone モードで表示し、ブラウザの UI（アドレスバー等）を非表示にする
4. THE PWA_App SHALL スプラッシュスクリーンを表示し、アプリアイコンとテーマカラーを使用する

### 要件 2: Service Worker の登録とライフサイクル管理

**ユーザーストーリー:** ユーザーとして、アプリが安定して動作し、バックグラウンドでも通知を受け取れるようにしたい。

#### 受け入れ基準

1. WHEN PWA_App が初回ロードされた時、THE PWA_App SHALL Service_Worker を自動的に登録する
2. WHEN Service_Worker の新しいバージョンが利用可能になった時、THE PWA_App SHALL ユーザーに更新を促す通知を表示する
3. IF Service_Worker の登録に失敗した場合、THEN THE PWA_App SHALL エラーをコンソールに記録し、通知機能なしで通常動作を継続する
4. THE Service_Worker SHALL プッシュ通知の受信と表示を処理する `push` イベントリスナーを含む
5. THE Service_Worker SHALL 通知クリック時のナビゲーションを処理する `notificationclick` イベントリスナーを含む

### 要件 3: プッシュ通知の購読管理

**ユーザーストーリー:** ログインユーザーとして、プッシュ通知の受信を自分で制御したい。不要な通知を受け取りたくないため。

#### 受け入れ基準

1. WHEN 認証済みユーザーが Dashboard にアクセスした時、THE PWA_App SHALL ブラウザの通知許可状態を確認する
2. WHEN 通知許可が未決定（default）の場合、THE PWA_App SHALL 通知を有効にするかどうかを尋ねる UI を表示する
3. WHEN ユーザーが通知を有効にした時、THE PWA_App SHALL `PushManager.subscribe()` を使用して Push_Subscription を作成し、Notification_Server に送信する
4. THE Notification_Server SHALL Push_Subscription をユーザー ID と関連付けて保存する
5. WHEN ユーザーが通知を無効にした時、THE PWA_App SHALL Push_Subscription を解除し、Notification_Server から削除する
6. IF ブラウザが Push API をサポートしていない場合、THEN THE PWA_App SHALL 通知関連の UI を非表示にする
7. WHEN ユーザーがログアウトした時、THE PWA_App SHALL 該当デバイスの Push_Subscription を Notification_Server から削除する

### 要件 4: VAPID 鍵の管理

**ユーザーストーリー:** システム管理者として、プッシュ通知の認証情報を安全に管理したい。

#### 受け入れ基準

1. THE Notification_Server SHALL VAPID_Key ペア（公開鍵と秘密鍵）を環境変数から読み込む
2. THE PWA_App SHALL VAPID 公開鍵をクライアント側の環境変数（`VITE_VAPID_PUBLIC_KEY`）から取得する
3. IF VAPID_Key が環境変数に設定されていない場合、THEN THE Notification_Server SHALL プッシュ通知機能を無効化し、警告ログを出力する

### 要件 5: ルーム招待通知

**ユーザーストーリー:** ルーム管理者として、ルームの URL を共有した相手にプッシュ通知で知らせたい。相手がアプリを開いていなくても気づけるようにするため。

#### 受け入れ基準

1. WHEN ルーム管理者が Dashboard で「URL 共有」ボタンを押した時、THE PWA_App SHALL 通知送信先のユーザーを選択する UI を表示する
2. WHEN 管理者が送信先を選択して招待を送信した時、THE Notification_Server SHALL 選択されたユーザーの全デバイスにプッシュ通知を送信する
3. THE プッシュ通知 SHALL ルーム名と招待者名を含むタイトルとメッセージを表示する
4. WHEN ユーザーが招待通知をタップした時、THE Service_Worker SHALL 該当ルームのページ（`/room/:id`）を開く
5. IF 送信先ユーザーの Push_Subscription が無効（期限切れ等）の場合、THEN THE Notification_Server SHALL 該当の Push_Subscription を削除し、送信をスキップする

### 要件 6: チャットメッセージ通知

**ユーザーストーリー:** ルーム参加者として、バックグラウンドにいる時にチャットメッセージの通知を受け取りたい。重要なメッセージを見逃さないため。

#### 受け入れ基準

1. WHEN ルーム内でチャットメッセージが送信された時、THE Notification_Server SHALL バックグラウンド状態の参加者にプッシュ通知を送信する
2. THE プッシュ通知 SHALL 送信者名とメッセージ内容（先頭 100 文字）を含む
3. WHEN ユーザーがチャット通知をタップした時、THE Service_Worker SHALL 該当ルームのページを開く
4. WHILE ユーザーが該当ルームをフォアグラウンドで表示している間、THE Notification_Server SHALL チャットメッセージのプッシュ通知を送信しない
5. WHEN 同一ルームから短時間（5 秒以内）に複数のチャットメッセージが届いた時、THE Service_Worker SHALL 通知をグループ化して 1 つにまとめる

### 要件 7: ユーザー入室通知

**ユーザーストーリー:** ルーム参加者として、新しいユーザーが入室した時に通知を受け取りたい。会議の開始を見逃さないため。

#### 受け入れ基準

1. WHEN 新しいユーザーがルームに入室した時、THE Notification_Server SHALL バックグラウンド状態の同ルーム参加者にプッシュ通知を送信する
2. THE プッシュ通知 SHALL 入室したユーザー名とルーム名を含む
3. WHEN ユーザーが入室通知をタップした時、THE Service_Worker SHALL 該当ルームのページを開く
4. WHILE ユーザーが該当ルームをフォアグラウンドで表示している間、THE Notification_Server SHALL 入室のプッシュ通知を送信しない

### 要件 8: フォアグラウンド・バックグラウンド状態の管理

**ユーザーストーリー:** ユーザーとして、アプリを見ている時に不要なプッシュ通知を受け取りたくない。

#### 受け入れ基準

1. THE PWA_App SHALL Page Visibility API を使用してフォアグラウンド・バックグラウンド状態を検出する
2. WHEN PWA_App がバックグラウンドに移行した時、THE PWA_App SHALL Socket.IO を通じて Notification_Server にバックグラウンド状態を通知する
3. WHEN PWA_App がフォアグラウンドに復帰した時、THE PWA_App SHALL Socket.IO を通じて Notification_Server にフォアグラウンド状態を通知する
4. THE Notification_Server SHALL 各ユーザーのフォアグラウンド・バックグラウンド状態をルーム単位で管理する

### 要件 9: 通知設定の永続化

**ユーザーストーリー:** ユーザーとして、通知の設定を一度行えば、次回以降も同じ設定で使いたい。

#### 受け入れ基準

1. THE Notification_Server SHALL Push_Subscription データをユーザー ID、デバイス識別子、作成日時と共にサーバー側の JSON ファイルに保存する
2. WHEN ユーザーが複数デバイスで PWA_App を使用した時、THE Notification_Server SHALL 各デバイスの Push_Subscription を個別に管理する
3. THE Notification_Server SHALL 通知送信時に全登録デバイスに対して通知を送信する
4. WHEN Push_Subscription の保存に失敗した場合、THEN THE Notification_Server SHALL エラーをログに記録し、ユーザーに再試行を促すレスポンスを返す
