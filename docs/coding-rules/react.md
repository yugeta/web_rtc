# React コーディングルール

## コンポーネント設計

- 1ファイル1コンポーネントを基本とする
- コンポーネント内のヘルパーコンポーネント（`VideoPlayer` 等）は同一ファイルに定義してよい
- Props の型定義は `interface` で明示する

## 状態管理

- ローカル状態は `useState` を使用する
- DOM 参照は `useRef` を使用する
- 副作用は `useEffect` で管理し、クリーンアップ関数を必ず返す

```tsx
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

## スタイリング

- インラインスタイル（`style={{ }}`）は使用しない（[CSS ルール](./css.md) 参照）
- 動的なスタイルは `className` の条件分岐または `data-*` 属性で制御する
- CSS クラス名の条件分岐にはテンプレートリテラルを使用する

```tsx
<button className={`icon ${!isEnabled ? 'active' : ''}`}>
```

## イベントハンドラ

- コンポーネント内で定義する関数は `const` + アロー関数で統一する
- 複雑なロジックはハンドラ関数として切り出す（JSX 内にロジックを書かない）

```tsx
// NG
<button onClick={() => { doA(); doB(); setC(true); }}>

// OK
const handleClick = () => {
  doA();
  doB();
  setC(true);
};
<button onClick={handleClick}>
```

## メディアデバイス操作

- `getUserMedia` の呼び出しは必ず `try/catch` で囲む
- ストリームのクリーンアップ（`track.stop()`）は `useEffect` のクリーンアップで行う
- デバイス切り替え時は `replaceTrack()` で既存の Peer 接続を維持する
