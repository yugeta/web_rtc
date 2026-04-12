import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotification } from '../hooks/usePushNotification';

/**
 * 通知許可プロンプトコンポーネント
 * Push API サポート時かつ通知許可が未決定（default）の場合のみ表示
 * Requirements: 3.1, 3.2, 3.3, 3.6
 */
export default function NotificationPrompt() {
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotification();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // 非表示条件: 非サポート、許可済み/拒否済み、購読済み、ユーザーが閉じた
  if (!isSupported || permission !== 'default' || isSubscribed || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribe();
    } catch {
      // subscribe 内でコンソールにログ出力済み
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(99, 102, 241, 0.15)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
      }}
    >
      <Bell size={20} style={{ color: '#818cf8', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '14px', color: '#e2e8f0' }}>
        プッシュ通知を有効にすると、ルームへの招待やチャットメッセージをリアルタイムで受け取れます。
      </span>
      <button
        onClick={handleEnable}
        disabled={loading}
        style={{
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '処理中...' : '通知を有効にする'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="閉じる"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
