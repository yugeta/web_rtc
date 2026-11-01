import { useRegisterSW } from 'virtual:pwa-register/react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import './ReloadPrompt.css';

function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, _registration) {
      // SW registered successfully
    },
    onRegisterError(error) {
      console.error('SW registration failed:', error);
    },
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);

  if (!needRefresh && !isUpdated) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
      setIsUpdated(true);
      setNeedRefresh(false);
    } catch {
      setIsUpdating(false);
    }
  };

  return (
    <div className="reload-prompt" role="alert">
      <div className="reload-prompt-content">
        {isUpdated ? <CheckCircle2 size={18} className="reload-prompt-icon success" /> : <RefreshCw size={18} className="reload-prompt-icon" />}
        <span className="reload-prompt-text">
          {isUpdated
            ? '更新しました。ページを再読込しています。'
            : isUpdating
              ? '更新を適用中です...'
              : 'アプリの更新を反映するには再読み込みが必要です'}
        </span>
      </div>
      <div className="reload-prompt-actions">
        {!isUpdated && (
          <button
            className="reload-prompt-update"
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? '更新中...' : '更新して再読込'}
          </button>
        )}
        {!isUpdated && (
          <button
            className="reload-prompt-dismiss"
            onClick={() => setNeedRefresh(false)}
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ReloadPrompt;
