# CSS コーディングルール

## インラインスタイル禁止

JSX/HTML に `style={{ }}` や `style=""` でスタイルを直接記述しない。全てのスタイルは CSS ファイルで管理する。

```tsx
// NG
<div style={{ color: 'red', marginBottom: '8px' }}>テキスト</div>

// OK
<div className="error-text">テキスト</div>
```

## 動的スタイルの制御方法

JavaScript の値に応じてスタイルを変える場合は、`className` の切り替えまたは `data-*` 属性を使う。

### className の切り替え

ON/OFF の2状態で切り替える場合:

```tsx
// NG
<button style={{ opacity: isActive ? 1 : 0.5 }}>

// OK
<button className={`icon ${isActive ? 'active' : ''}`}>
```

### data-* 属性

CSS セレクタで状態を参照する場合:

```tsx
// NG
<div style={{ opacity: isEnabled ? 1 : 0 }}>

// OK
<div className="visualizer" data-active={isEnabled}>
```

```css
.visualizer[data-active="false"] {
  opacity: 0;
}

.visualizer[data-active="true"] {
  opacity: 1;
}
```

## セレクタの優先度

スタイルの上書きは CSS のセレクタ詳細度のみで制御する。`!important` は原則使用しない。

詳細度の順序（低 → 高）:

1. 要素セレクタ: `button`
2. クラスセレクタ: `.icon`
3. 複合クラスセレクタ: `button.icon`
4. 複合クラス + クラス: `button.icon.leave-btn`
5. 属性セレクタ: `button.icon[data-disabled="true"]`

## ファイル構成

- グローバルスタイル: `index.css`
- コンポーネント固有のスタイルが大きくなった場合は、コンポーネント名に対応する CSS ファイルに分離する

## レスポンシブ対応

メディアクエリは CSS ファイルの末尾にまとめて記述する。ブレークポイント:

| 名称 | 幅 |
|---|---|
| タブレット | `max-width: 768px` |
| スマートフォン | `max-width: 480px` |
| 横向きスマートフォン | `max-height: 500px` and `orientation: landscape` |

## 命名規則

- クラス名はケバブケース: `video-wrapper`, `leave-modal-title`
- 状態を表すクラス: `active`, `selected`, `empty`, `disabled`
- レイアウト用クラス: `-container`, `-wrapper`, `-grid`
- 子要素: 親クラス名をプレフィックスにする（例: `leave-modal-title`, `leave-modal-desc`）
