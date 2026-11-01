import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
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

  if (!needRefresh) return null;

  return (
    <div className="reload-prompt" role="alert">
      <div className="reload-prompt-content">
        <RefreshCw size={18} className="reload-prompt-icon" />
        <span className="reload-prompt-text">
          新しいバージョンが利用可能です
        </span>
      </div>
      <div className="reload-prompt-actions">
        <button
          className="reload-prompt-update"
          onClick={() => updateServiceWorker(true)}
        >
          更新する
        </button>
        <button
          className="reload-prompt-dismiss"
          onClick={() => setNeedRefresh(false)}
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default ReloadPrompt;
