# 実装計画: URLクエリパラメータによるルームID事前設定

## 概要

`App.tsx` に純粋関数 `parseRoomQueryParam` を追加し、URLクエリパラメータ `?room=room名` からルームID入力フィールドの初期値を設定する。テストフレームワーク（vitest + fast-check）のセットアップも含む。

## タスク

- [x] 1. テスト環境のセットアップ
  - [x] 1.1 vitest と fast-check をインストールし、vite.config.ts にテスト設定を追加する
    - `vitest`, `fast-check` を devDependencies に追加
    - `vite.config.ts` に `test` 設定を追加
    - `package.json` に `test` スクリプトを追加
    - _Requirements: なし（テスト基盤）_

- [x] 2. parseRoomQueryParam 関数の実装とテスト
  - [x] 2.1 `App.tsx` に `parseRoomQueryParam` 純粋関数を追加する
    - `parseRoomQueryParam(search: string): string | null` を実装
    - URLSearchParams で `room` パラメータを取得
    - 正規表現 `/^[a-zA-Z0-9_-]+$/` でバリデーション
    - 関数を export する（テストからインポートするため）
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [ ]* 2.2 parseRoomQueryParam のプロパティベーステストを作成する
    - **Property 1: ルーム名パースのラウンドトリップ**
    - 有効なルーム名（英数字・ハイフン・アンダースコア）を生成し、`?room={ルーム名}` を構築してパース結果が元の値と一致することを確認
    - 不正文字を含む文字列や空文字では `null` が返ることを確認
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3**

  - [ ]* 2.3 parseRoomQueryParam のユニットテストを作成する
    - `?room=my-room` → `"my-room"`
    - `?room=test_123` → `"test_123"`
    - `?room=` → `null`
    - `?room=my room` → `null`
    - `?room=my/room` → `null`
    - クエリパラメータなし → `null`
    - `?other=value` → `null`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

- [x] 3. チェックポイント - テスト確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. App.tsx の useEffect にクエリパラメータ解析を統合する
  - [x] 4.1 既存の useEffect を拡張し、初回レンダリング時にクエリパラメータからルームIDを設定する
    - `parseRoomQueryParam(window.location.search)` を呼び出し
    - 結果が `null` でなければ `setRoomId` で初期値を設定
    - 既存の Cookie からのユーザー名読み込みロジックはそのまま維持
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_

- [x] 5. 最終チェックポイント - すべてのテストが通ることを確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件への追跡可能性のため、具体的な要件番号を参照
- 変更対象は `App.tsx` のみ（設計ドキュメントに準拠）
- プロパティテストは fast-check を使用し、最低100回のイテレーションで実行
