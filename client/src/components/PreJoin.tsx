import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, ChevronUp, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

// MediaSettings型をexport
export type MediaSettings = {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  outputDeviceId: string;
};

interface PreJoinProps {
  userName: string;
  roomId: string;
  roomName?: string;
  onJoin: (settings: MediaSettings) => void;
  onCancel: () => void;
}

// Cookie管理
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const setCookie = (name: string, value: string, days: number = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

const PreJoin: React.FC<PreJoinProps> = ({ userName, roomId, roomName, onJoin, onCancel }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');
  
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // 権限チェック状態
  const [permissionDenied, setPermissionDenied] = useState<string[]>([]);
  const [permissionChecked, setPermissionChecked] = useState(false);

  // Cookieから設定を読み込む
  useEffect(() => {
    const checkPermissionsAndInit = async () => {
      // Permissions API で事前チェック
      const denied: string[] = [];
      try {
        const [cam, mic] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null),
          navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null),
        ]);
        if (cam?.state === 'denied') denied.push('カメラ');
        if (mic?.state === 'denied') denied.push('マイク');
      } catch {
        // Permissions API 未対応（Safari等）→ getUserMedia で判定させる
      }

      if (denied.length > 0) {
        setPermissionDenied(denied);
        setPermissionChecked(true);
        return;
      }

      setPermissionChecked(true);

      // 権限がブロックされていなければメディア初期化へ
      const savedAudioEnabled = getCookie('isAudioEnabled');
      const savedVideoEnabled = getCookie('isVideoEnabled');
      const savedSpeakerEnabled = getCookie('isSpeakerEnabled');
      const savedAudioDevice = getCookie('audioDeviceId');
      const savedVideoDevice = getCookie('videoDeviceId');
      const savedOutputDevice = getCookie('outputDeviceId');

      if (savedAudioEnabled !== null) setIsAudioEnabled(savedAudioEnabled === 'true');
      if (savedVideoEnabled !== null) setIsVideoEnabled(savedVideoEnabled === 'true');
      if (savedSpeakerEnabled !== null) setIsSpeakerEnabled(savedSpeakerEnabled === 'true');

      initializeMedia(
        savedAudioDevice,
        savedVideoDevice,
        savedOutputDevice,
        savedAudioEnabled === null ? true : savedAudioEnabled === 'true',
        savedVideoEnabled === null ? true : savedVideoEnabled === 'true'
      );
    };

    checkPermissionsAndInit();
  }, []);

  const initializeMedia = async (
    savedAudioDevice: string | null,
    savedVideoDevice: string | null,
    savedOutputDevice: string | null,
    audioEnabled: boolean,
    videoEnabled: boolean
  ) => {
    try {
      // まず権限を取得するために一旦getUserMediaを呼ぶ
      // これによりenumerateDevicesでラベル付きのデバイスリストが取得できる
      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // デバイスリストを取得（権限取得後なのでラベルが取れる）
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setAudioOutputDevices(audioOutputs);
      
      // OSの既定デバイスを探す
      const defaultAudioDevice = audioInputs.find(d => {
        const label = d.label.toLowerCase();
        return (
          label.includes('既定') ||
          label.includes('規定') ||
          label.includes('default') ||
          label.includes('默认') ||
          label.includes('預設') ||
          label.includes('기본') ||
          label.includes('défaut') ||
          label.includes('predeterminado') ||
          label.includes('padrão') ||
          label.includes('standard') ||
          label.includes('standaard') ||
          label.includes('predefinito') ||
          d.deviceId === 'default' ||
          d.deviceId === 'communications'
        );
      });
      
      // 保存されたデバイスが存在するか確認
      const audioDeviceExists = savedAudioDevice && audioInputs.some(d => d.deviceId === savedAudioDevice);
      const videoDeviceExists = savedVideoDevice && videoInputs.some(d => d.deviceId === savedVideoDevice);
      const outputDeviceExists = savedOutputDevice && audioOutputs.some(d => d.deviceId === savedOutputDevice);
      
      // デバイスIDを決定
      const audioDeviceId = audioDeviceExists 
        ? savedAudioDevice 
        : (defaultAudioDevice?.deviceId || (audioInputs[0]?.deviceId || 'default'));
      
      const videoDeviceId = videoDeviceExists
        ? savedVideoDevice
        : (videoInputs[0]?.deviceId || 'default');
      
      const outputDeviceId = outputDeviceExists
        ? savedOutputDevice
        : (audioOutputs[0]?.deviceId || 'default');
      
      setSelectedAudioDeviceId(audioDeviceId);
      setSelectedVideoDeviceId(videoDeviceId);
      setSelectedOutputDeviceId(outputDeviceId);
      
      // 一時ストリームを停止
      tempStream.getTracks().forEach(track => track.stop());

      // 選択したデバイスでメディアストリームを再取得
      const audioConstraints = audioDeviceId && audioDeviceId !== 'default' && audioDeviceId !== 'communications'
        ? { deviceId: { ideal: audioDeviceId } }
        : true;
      
      const videoConstraints = videoDeviceId && videoDeviceId !== 'default'
        ? { deviceId: { ideal: videoDeviceId } }
        : true;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints
      });
      
      // 初期状態を適用
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      
      if (audioTrack) audioTrack.enabled = audioEnabled;
      if (videoTrack) videoTrack.enabled = videoEnabled;
      
      setLocalStream(stream);
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Failed to get media:', err);
      setPermissionDenied(['カメラ', 'マイク']);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // localStreamが変わったらvideoRefに反映
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        setCookie('isAudioEnabled', String(audioTrack.enabled));
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        setCookie('isVideoEnabled', String(videoTrack.enabled));
      }
    }
  };

  const toggleSpeaker = () => {
    const newState = !isSpeakerEnabled;
    setIsSpeakerEnabled(newState);
    setCookie('isSpeakerEnabled', String(newState));
  };

  const changeAudioDevice = async (deviceId: string) => {
    if (!deviceId) return;
    
    try {
      const constraints = {
        video: false,
        audio: deviceId === 'default' ? true : { deviceId: deviceId }
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newStream.getAudioTracks()[0];
      
      if (localStreamRef.current && newAudioTrack) {
        const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
        
        if (oldAudioTrack) {
          localStreamRef.current.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        
        localStreamRef.current.addTrack(newAudioTrack);
        newAudioTrack.enabled = isAudioEnabled;
        
        const updatedStream = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(updatedStream);
        localStreamRef.current = updatedStream;
        
        setSelectedAudioDeviceId(deviceId);
        setCookie('audioDeviceId', deviceId);
        setShowAudioMenu(false);
      }
    } catch (err) {
      console.error('Failed to change audio device:', err);
      alert('マイクの切り替えに失敗しました。');
    }
  };

  const changeVideoDevice = async (deviceId: string) => {
    if (!deviceId) return;
    
    try {
      const constraints = {
        audio: false,
        video: deviceId === 'default' ? true : { deviceId: deviceId }
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (localStreamRef.current && newVideoTrack) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        
        localStreamRef.current.addTrack(newVideoTrack);
        newVideoTrack.enabled = isVideoEnabled;
        
        const updatedStream = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(updatedStream);
        localStreamRef.current = updatedStream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = updatedStream;
        }
        
        setSelectedVideoDeviceId(deviceId);
        setCookie('videoDeviceId', deviceId);
        setShowVideoMenu(false);
      }
    } catch (err) {
      console.error('Failed to change video device:', err);
      alert('カメラの切り替えに失敗しました。');
    }
  };

  const changeOutputDevice = (deviceId: string) => {
    if (!deviceId) return;
    setSelectedOutputDeviceId(deviceId);
    setCookie('outputDeviceId', deviceId);
    setShowOutputMenu(false);
  };

  const handleJoin = () => {
    const settings: MediaSettings = {
      isAudioEnabled,
      isVideoEnabled,
      isSpeakerEnabled,
      audioDeviceId: selectedAudioDeviceId,
      videoDeviceId: selectedVideoDeviceId,
      outputDeviceId: selectedOutputDeviceId
    };
    
    // ストリームは停止せずに渡す
    onJoin(settings);
  };

  return (
    <div className="home-container">
      <div className="glass-panel prejoin-panel">
        <h2 className="prejoin-title">会議に参加する準備</h2>
        <p className="prejoin-desc">
          {userName} として {roomName || roomId} に参加します
        </p>

        {/* 権限ブロック時のガイダンス */}
        {permissionDenied.length > 0 ? (
          <>
            <div className="permission-banner" style={{ marginBottom: '24px' }}>
              <AlertTriangle size={16} />
              <span>
                {permissionDenied.join('・')}へのアクセスがブロックされています。
                ブラウザのアドレスバー付近の設定から許可した後、再度お試しください。
              </span>
            </div>
            <div className="prejoin-actions">
              <button onClick={onCancel} className="prejoin-cancel">戻る</button>
              <button onClick={() => window.location.reload()} className="primary prejoin-join">再読み込み</button>
            </div>
          </>
        ) : (
          <>
        
        {/* ビデオプレビュー */}
        <div className="video-preview-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-preview"
            data-visible={!!(localStream && isVideoEnabled)}
          />
          {!localStream && (
            <div className="video-preview-overlay">
              <div className="video-preview-spinner" />
              <div>カメラを準備しています...</div>
            </div>
          )}
          {localStream && !isVideoEnabled && (
            <div className="video-preview-overlay">
              <VideoOff size={48} className="video-preview-icon" />
              <div>カメラがオフです</div>
            </div>
          )}
        </div>
        
        {/* コントロール */}
        <div className="controls-bar prejoin-controls">
          {/* マイク */}
          <div className="control-group">
            <button 
              className={`icon ${!isAudioEnabled ? 'active' : ''}`} 
              onClick={toggleAudio}
              title="Toggle Mic"
            >
              {isAudioEnabled ? <Mic /> : <MicOff />}
            </button>
            
            <div>
              <button 
                className="icon-small" 
                onClick={() => setShowAudioMenu(!showAudioMenu)}
                title="Select Microphone"
              >
                <ChevronUp size={16} />
              </button>
              
              {showAudioMenu && (
                <div className="device-menu">
                  <div className="device-menu-title">Select Microphone</div>
                  {audioDevices.map((device, idx) => (
                    <div 
                      key={device.deviceId || String(idx)} 
                      className={`device-menu-item ${device.deviceId === selectedAudioDeviceId ? 'selected' : ''}`}
                      onClick={() => changeAudioDevice(device.deviceId)}
                    >
                      {device.label || `Microphone ${idx + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* カメラ */}
          <div className="control-group">
            <button 
              className={`icon ${!isVideoEnabled ? 'active' : ''}`} 
              onClick={toggleVideo}
              title="Toggle Video"
            >
              {isVideoEnabled ? <Video /> : <VideoOff />}
            </button>
            
            <div>
              <button 
                className="icon-small" 
                onClick={() => setShowVideoMenu(!showVideoMenu)}
                title="Select Camera"
              >
                <ChevronUp size={16} />
              </button>
              
              {showVideoMenu && (
                <div className="device-menu">
                  <div className="device-menu-title">Select Camera</div>
                  {videoDevices.map((device, idx) => (
                    <div 
                      key={device.deviceId || String(idx)} 
                      className={`device-menu-item ${device.deviceId === selectedVideoDeviceId ? 'selected' : ''}`}
                      onClick={() => changeVideoDevice(device.deviceId)}
                    >
                      {device.label || `Camera ${idx + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* スピーカー */}
          <div className="control-group">
            <button 
              className={`icon ${!isSpeakerEnabled ? 'active' : ''}`} 
              onClick={toggleSpeaker}
              title="Toggle Speaker"
            >
              {isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
            </button>
            
            <div>
              <button 
                className="icon-small" 
                onClick={() => setShowOutputMenu(!showOutputMenu)}
                title="Select Speaker"
              >
                <ChevronUp size={16} />
              </button>
              
              {showOutputMenu && (
                <div className="device-menu">
                  <div className="device-menu-title">Select Speaker</div>
                  {audioOutputDevices.map((device, idx) => (
                    <div 
                      key={device.deviceId || String(idx)} 
                      className={`device-menu-item ${device.deviceId === selectedOutputDeviceId ? 'selected' : ''}`}
                      onClick={() => changeOutputDevice(device.deviceId)}
                    >
                      {device.label || `Speaker ${idx + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* ボタン */}
        <div className="prejoin-actions">
          <button 
            onClick={onCancel}
            className="prejoin-cancel"
          >
            キャンセル
          </button>
          <button 
            onClick={handleJoin}
            className="primary prejoin-join"
          >
            参加する
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PreJoin;
