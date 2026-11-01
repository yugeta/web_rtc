# 要件定義書

## はじめに

WebRTC Meet（ビデオ会議アプリ）に Google OAuth ログイン機能を追加する。Room 管理者は Google アカウントでログインし、Room の作成・管理・URL 共有を行う。Room 利用者はログイン不要で、共有された URL から直接 Room に参加できる。現在の state ベースの画面切り替えを react-router-dom によるルーティングに移行し、ランディングページ・ダッシュボード・Room ページの 3 画面構成とする。

## 用語集

- **Client**: React 19 + Vite で構築されたフロントエンドアプリケーション
- **Server**: Express 5 + Socket.IO で構築されたバックエンドサーバー
- **Auth_API**: Server 上の認証関連 REST エンドポイント群（`/api/auth/*`）
- **Rooms_API**: Server 上の Room 管理 REST エンドポイント群（`/api/rooms/*`）
- **Token_Verifier**: Server 上で Google ID トークンを検証し JWT を発行するモジュール
- **Room_Store**: Room データを JSON ファイルで永続化するモジュール
- **Auth_Context**: Client 上で認証状態（JWT、ユーザー情報）を管理する React Context
- **Protected_Route**: ログイン済みユーザーのみアクセスを許可するルートガードコンポーネント
- **Dashboard**: ログイン後に表示される Room 一覧・作成・管理画面
- **PreJoin**: Room 参加前のメディア設定・名前入力画面
- **Landing_Page**: Google ログインボタンを配置したトップページ
- **Room_Admin**: Google OAuth でログインし Room を作成・管理するユーザー
- **Room_Participant**: 共有 URL から Room に参加するユーザー（ログイン不要）
- **ID_Token**: Google Sign-In で取得される Google 発行の ID トークン
- **JWT**: Server が発行するアプリケーション固有の JSON Web Token
- **Router**: react-router-dom によるクライアントサイドルーティング機構

## 要件

### 要件 1: Google OAuth ログイン

**ユーザーストーリー:** Room 管理者として、Google アカウントでログインしたい。安全に認証された状態で Room を管理できるようにするため。

#### 受け入れ基準

1. THE Landing_Page SHALL Google ログインボタンを表示する
2. WHEN Room_Admin が Google ログインボタンをクリックした場合、THE Client SHALL `@react-oauth/google` を使用してポップアップ型 Google Sign-In を開始し、ID_Token を取得する
3. WHEN Client が ID_Token を取得した場合、THE Client SHALL `POST /api/auth/google` に ID_Token を送信する
4. WHEN Auth_API が有効な ID_Token を受信した場合、THE Token_Verifier SHALL `google-auth-library` を使用して ID_Token を検証し、検証成功時に JWT を発行してレスポンスに含める
5. IF Auth_API が無効な ID_Token を受信した場合、THEN THE Auth_API SHALL HTTP 401 ステータスコードとエラーメッセージを返す
6. WHEN Client が JWT を受信した場合、THE Auth_Context SHALL JWT とユーザー情報（名前、メールアドレス、プロフィール画像 URL）を保持する
7. THE Auth_Context SHALL JWT をブラウザの localStorage に保存し、ページリロード後も認証状態を維持する

### 要件 2: JWT 認証ミドルウェア

**ユーザーストーリー:** システム管理者として、保護された API エンドポイントへのアクセスを JWT で制御したい。認証されたユーザーのみが Room 管理操作を実行できるようにするため。

#### 受け入れ基準

1. WHEN 保護された API エンドポイントにリクエストが送信された場合、THE Server SHALL Authorization ヘッダーから Bearer トークンを抽出し JWT を検証する
2. IF JWT が無効または期限切れの場合、THEN THE Server SHALL HTTP 401 ステータスコードを返す
3. IF Authorization ヘッダーが存在しない場合、THEN THE Server SHALL HTTP 401 ステータスコードを返す
4. WHEN JWT の検証が成功した場合、THE Server SHALL デコードされたユーザー情報をリクエストオブジェクトに付与して次のハンドラーに渡す

### 要件 3: Room 管理 API

**ユーザーストーリー:** Room 管理者として、Room の作成・一覧表示・削除を行いたい。ビデオ会議の Room を効率的に管理できるようにするため。

#### 受け入れ基準

1. WHEN Room_Admin が `POST /api/rooms` に Room 名を送信した場合、THE Rooms_API SHALL 一意の Room ID を生成し、Room データを Room_Store に保存してレスポンスに Room 情報を返す
2. WHEN Room_Admin が `GET /api/rooms` にリクエストを送信した場合、THE Rooms_API SHALL 該当 Room_Admin が作成した Room の一覧を返す
3. WHEN Room_Admin が `DELETE /api/rooms/:id` にリクエストを送信した場合、THE Rooms_API SHALL 該当 Room_Admin が所有する Room を Room_Store から削除する
4. IF Room_Admin が所有していない Room を削除しようとした場合、THEN THE Rooms_API SHALL HTTP 403 ステータスコードを返す
5. IF 存在しない Room ID に対して削除リクエストが送信された場合、THEN THE Rooms_API SHALL HTTP 404 ステータスコードを返す
6. THE Rooms_API SHALL すべてのエンドポイントで JWT 認証を要求する

### 要件 4: Room データ永続化

**ユーザーストーリー:** システム管理者として、Room データを永続化したい。サーバー再起動後も Room 情報が保持されるようにするため。

#### 受け入れ基準

1. THE Room_Store SHALL Room データを JSON ファイルに保存する
2. THE Room_Store SHALL 各 Room に対して Room ID、Room 名、作成者のユーザー ID、作成日時を保存する
3. WHEN Room_Store が Room データを読み込む場合、THE Room_Store SHALL JSON ファイルをパースして Room オブジェクトの配列を返す
4. WHEN Room_Store が Room データを書き込む場合、THE Room_Store SHALL Room オブジェクトの配列を JSON ファイルにシリアライズして保存する
5. IF JSON ファイルが存在しない場合、THEN THE Room_Store SHALL 空の配列で初期化する
6. THE Room_Store SHALL 将来の拡張（セキュア Room、利用者認証等）に対応できるよう、Room データに拡張可能なフィールド構造を持つ
7. FOR ALL 有効な Room オブジェクトの配列に対して、Room_Store に書き込んだ後に読み込んだ結果は元の配列と等価である（ラウンドトリップ特性）

### 要件 5: クライアントサイドルーティング

**ユーザーストーリー:** ユーザーとして、URL ベースのナビゲーションを利用したい。ブックマークや URL 共有で直接目的の画面にアクセスできるようにするため。

#### 受け入れ基準

1. THE Client SHALL react-router-dom を使用してクライアントサイドルーティングを実装する
2. THE Router SHALL `/` パスで Landing_Page を表示する
3. THE Router SHALL `/dashboard` パスで Dashboard を表示する
4. THE Router SHALL `/room/:id` パスで Room ページ（PreJoin → Room）を表示する
5. WHEN 未認証ユーザーが `/dashboard` にアクセスした場合、THE Protected_Route SHALL ユーザーを `/` にリダイレクトする
6. WHEN 認証済みユーザーが `/` にアクセスした場合、THE Router SHALL ユーザーを `/dashboard` にリダイレクトする
7. THE Router SHALL `/room/:id` パスへのアクセスに認証を要求しない

### 要件 6: Dashboard 画面

**ユーザーストーリー:** Room 管理者として、ログイン後に Room の一覧表示・作成・URL 共有を行いたい。Room を簡単に管理し参加者に共有できるようにするため。

#### 受け入れ基準

1. WHEN Room_Admin が Dashboard にアクセスした場合、THE Dashboard SHALL Room_Admin が作成した Room の一覧を表示する
2. THE Dashboard SHALL 各 Room に対して Room 名、作成日時、参加用 URL を表示する
3. WHEN Room_Admin が Room 作成フォームを送信した場合、THE Dashboard SHALL `POST /api/rooms` を呼び出して新しい Room を作成し、一覧を更新する
4. WHEN Room_Admin が Room の URL 共有ボタンをクリックした場合、THE Dashboard SHALL 該当 Room の参加用 URL（`/room/:id` 形式）をクリップボードにコピーする
5. WHEN Room_Admin が Room の削除ボタンをクリックした場合、THE Dashboard SHALL 確認ダイアログを表示し、確認後に `DELETE /api/rooms/:id` を呼び出して Room を削除する
6. THE Dashboard SHALL ログアウトボタンを表示し、クリック時に Auth_Context の認証状態をクリアして Landing_Page にリダイレクトする
7. THE Dashboard SHALL Room_Admin のプロフィール画像と名前を表示する

### 要件 7: Room ページ（Room 利用者の導線）

**ユーザーストーリー:** Room 利用者として、共有された URL から直接 Room に参加したい。ログインなしで簡単にビデオ会議に参加できるようにするため。

#### 受け入れ基準

1. WHEN Room_Participant が `/room/:id` にアクセスした場合、THE Client SHALL 認証を要求せずに PreJoin 画面を表示する
2. THE PreJoin SHALL Room_Participant に名前の入力を求め、入力された名前を Cookie に保存する（既存の動作を維持）
3. WHEN Room_Participant が PreJoin で参加ボタンをクリックした場合、THE Client SHALL Room 画面に遷移してビデオ会議に参加する
4. IF 存在しない Room ID で `/room/:id` にアクセスした場合、THEN THE Client SHALL Room が存在しない旨のエラーメッセージを表示する

### 要件 8: Socket.IO JWT 認証

**ユーザーストーリー:** Room 管理者として、Socket.IO 接続時に認証情報を送信したい。管理者としての操作が安全に行えるようにするため。

#### 受け入れ基準

1. WHILE Room_Admin が認証済みの場合、THE Client SHALL Socket.IO 接続時に JWT を auth オプションに含めて送信する
2. WHEN Socket.IO 接続で JWT が提供された場合、THE Server SHALL JWT を検証し、有効な場合はソケットにユーザー情報を付与する
3. IF Socket.IO 接続で無効な JWT が提供された場合、THEN THE Server SHALL 接続を拒否せず、未認証ユーザーとして扱う
4. WHEN Room_Participant が JWT なしで Socket.IO に接続した場合、THE Server SHALL 接続を許可し、通常の Room 参加機能を提供する

### 要件 9: 環境変数と設定

**ユーザーストーリー:** 開発者として、認証に必要な設定を環境変数で管理したい。セキュリティを確保しつつ環境ごとに設定を切り替えられるようにするため。

#### 受け入れ基準

1. THE Client SHALL `VITE_GOOGLE_CLIENT_ID` 環境変数から Google Client ID を読み込む
2. THE Server SHALL `GOOGLE_CLIENT_ID` 環境変数から Google Client ID を読み込む
3. THE Server SHALL `JWT_SECRET` 環境変数から JWT 署名用シークレットを読み込む
4. IF 必須の環境変数が設定されていない場合、THEN THE Server SHALL 起動時にエラーメッセージを出力して終了する
