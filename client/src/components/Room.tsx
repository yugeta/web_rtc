import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

interface RoomProps {
  roomId: string;
  userName: string;
  initialSettings?: {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isSpeakerEnabled: boolean;
    audioDeviceId: string;
    videoDeviceId: string;
    outputDeviceId: string;
  };
  onLeave: () => void;
}

interface PeerData {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  userName?: string;
  dataChannel?: RTCDataChannel;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// 個別のビデオ表示用コンポーネント
const VideoPlayer = ({ 
  stream, 
  isLocal = false, 
  label, 
  outputDeviceId, 
  isSpeakerEnabled = true,
  isAudioEnabled = true,
  isVideoEnabled = true 
}: { 
  stream: MediaStream | null, 
  isLocal?: boolean, 
  label: string, 
  outputDeviceId?: string, 
  isSpeakerEnabled?: boolean,
  isAudioEnabled?: boolean,
  isVideoEnabled?: boolean
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 出力デバイスが変更されたときに適用
  useEffect(() => {
    const applyOutputDevice = async () => {
      if (videoRef.current && outputDeviceId && 'setSinkId' in videoRef.current) {
        try {
          await (videoRef.current as any).setSinkId(outputDeviceId);
          console.log('[VideoPlayer] Applied output device:', outputDeviceId, 'to', label);
        } catch (err) {
          console.warn('[VideoPlayer] Failed to set output device:', err);
        }
      }
    };
    
    applyOutputDevice();
  }, [outputDeviceId, label]);

  // スピーカーのミュート状態を適用（自分のビデオは常にミュート）
  useEffect(() => {
    if (videoRef.current && !isLocal) {
      videoRef.current.muted = !isSpeakerEnabled;
    }
  }, [isSpeakerEnabled, isLocal]);

  return (
    <div className="video-wrapper">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={isLocal} 
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      
      <div className="video-label">{label}</div>
      
      {/* 状態アイコン表示（OFFの時のみ、自分のビデオには表示しない） */}
      {!isLocal && (
        <div className="video-status-icons">
          {!isAudioEnabled && (
            <div className="status-icon" title="Microphone Off">
              <MicOff size={20} />
            </div>
          )}
          {!isVideoEnabled && (
            <div className="status-icon" title="Camera Off">
              <VideoOff size={20} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Room: React.FC<RoomProps> = ({ roomId, userName, initialSettings, onLeave }) => {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialSettings?.isVideoEnabled ?? true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialSettings?.isAudioEnabled ?? true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(initialSettings?.isSpeakerEnabled ?? true);
  
  // デバイス選択用のState
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(initialSettings?.audioDeviceId || '');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  
  // スピーカー選択用のState
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>(initialSettings?.outputDeviceId || '');
  const [showOutputMenu, setShowOutputMenu] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [socketId: string]: Peer.Instance }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;
    let currentStream: MediaStream | null = null;

    const initializeMedia = async () => {
      try {
        console.log('[Room] Requesting media devices...');
        
        // initialSettingsがある場合はそれを使用
        let audioDeviceId = initialSettings?.audioDeviceId || '';
        
        if (!audioDeviceId) {
          // まずデバイスリストを取得
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          
          console.log('[Room] Available audio devices:', audioInputs.map((d, idx) => ({
            index: idx,
            deviceId: d.deviceId,
            label: d.label,
            labelLowerCase: d.label.toLowerCase(),
            groupId: d.groupId
          })));
          
          // OSの既定デバイスを探す（複数の言語パターンに対応）
          const defaultDevice = audioInputs.find(d => {
            const label = d.label.toLowerCase();
            
            console.log('[Room] Checking device:', d.label);
            console.log('  - label.includes("規定"):', label.includes('規定'));
            console.log('  - label.includes("既定"):', label.includes('既定'));
            console.log('  - label.includes("default"):', label.includes('default'));
            console.log('  - d.deviceId:', d.deviceId);
            
            const isDefault = (
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
            
            console.log('  - isDefault:', isDefault);
            
            if (isDefault) {
              console.log('[Room] ✓ Found default device:', d.label, 'deviceId:', d.deviceId);
            }
            
            return isDefault;
          });
          
          console.log('[Room] Default device result:', defaultDevice?.label || 'Not found');
          console.log('[Room] Default device object:', defaultDevice);
          
          // 既定デバイスがない場合、仮想デバイスを除外して実際のマイクを探す
          const realMicrophone = !defaultDevice ? audioInputs.find(d => 
            d.label && 
            !d.label.toLowerCase().includes('virtual') &&
            !d.label.toLowerCase().includes('blackhole') &&
            !d.label.toLowerCase().includes('loopback') &&
            d.deviceId !== 'default' &&
            d.deviceId !== 'communications'
          ) : null;
          
          // 優先順位: 既定デバイス > 実際のマイク > 制約なし（ブラウザに任せる）
          const selectedDevice = defaultDevice || realMicrophone;
          audioDeviceId = selectedDevice?.deviceId || '';
        }
        
        // deviceIdが'default'の場合は制約を設定しない（ブラウザのデフォルトを使用）
        const audioConstraints = audioDeviceId && audioDeviceId !== 'default' && audioDeviceId !== 'communications'
          ? { deviceId: { ideal: audioDeviceId } }
          : true;
        
        console.log('[Room] Selected audio device ID:', audioDeviceId || 'Browser default');
        console.log('[Room] Using audio constraints:', audioConstraints);
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: audioConstraints
        });
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        currentStream = stream;

        // initialSettingsの状態を適用
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        
        if (audioTrack && initialSettings) {
          audioTrack.enabled = initialSettings.isAudioEnabled;
        }
        if (videoTrack && initialSettings) {
          videoTrack.enabled = initialSettings.isVideoEnabled;
        }

        console.log('[Room] Media stream obtained:', {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTrack: stream.getAudioTracks()[0]?.label,
          audioEnabled: stream.getAudioTracks()[0]?.enabled
        });

        setLocalStream(stream);
        localStreamRef.current = stream;

        // デバイスリストの取得（再取得して最新の状態を反映）
        const updatedDevices = await navigator.mediaDevices.enumerateDevices();
        const updatedAudioInputs = updatedDevices.filter(d => d.kind === 'audioinput');
        const updatedAudioOutputs = updatedDevices.filter(d => d.kind === 'audiooutput');
        
        setAudioDevices(updatedAudioInputs);
        setAudioOutputDevices(updatedAudioOutputs);
        
        // 選択したデバイスIDを設定
        if (initialSettings?.audioDeviceId) {
          setSelectedAudioDeviceId(initialSettings.audioDeviceId);
        } else if (audioDeviceId) {
          console.log('[Room] Setting selected device ID:', audioDeviceId);
          setSelectedAudioDeviceId(audioDeviceId);
        } else if (updatedAudioInputs.length > 0) {
          // フォールバック: ストリームから取得したデバイスIDを使用
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack && audioTrack.getSettings().deviceId) {
            setSelectedAudioDeviceId(audioTrack.getSettings().deviceId!);
          } else {
            setSelectedAudioDeviceId(updatedAudioInputs[0].deviceId);
          }
        }
        
        // デフォルトの出力デバイスを設定
        if (initialSettings?.outputDeviceId) {
          setSelectedOutputDeviceId(initialSettings.outputDeviceId);
        } else if (updatedAudioOutputs.length > 0) {
          setSelectedOutputDeviceId(updatedAudioOutputs[0].deviceId || 'default');
        }

        // 2. Socket接続
        socketRef.current = io(SERVER_URL);

        // 3. ルーム参加（ユーザー名も送信）
        socketRef.current.emit('join-room', { roomId, userName });

        // 4. すでに居るユーザー全員に対してPeerを作成 (発信側)
        socketRef.current.on('all-users', (usersInRoom: Array<{ userId: string, userName: string }>) => {
          console.log('[all-users] Received users:', usersInRoom);
          usersInRoom.forEach(user => {
            console.log('[all-users] Creating peer for:', user.userId, user.userName);
            
            const currentStream = localStreamRef.current || stream;
            const peer = createPeer(user.userId, socketRef.current?.id || '', currentStream);
            peersRef.current[user.userId] = peer;
            
            // UIに表示するための初期ダミーストリームを登録
            setPeers(prev => {
              const newPeer = { 
                peerId: user.userId, 
                peer, 
                userName: user.userName,
                isAudioEnabled: true, // DataChannelで更新される
                isVideoEnabled: true  // DataChannelで更新される
              };
              console.log('[all-users] Adding peer to state:', newPeer);
              return [...prev, newPeer];
            });
          });
        });

        // 5. 新規アクセス者が来た場合（受信側のアクションはOfferが来るのを待つだけ）
        socketRef.current.on('user-connected', (payload: { userId: string, userName: string }) => {
          console.log('User connected', payload.userId, payload.userName);
        });

        // 6. 単一のシグナルパスでOffer/Answer/Candidateすべてを受け取る
        socketRef.current.on('signal', (payload: { caller: string, signal: any, userName?: string }) => {
          let peer = peersRef.current[payload.caller];
          
          if (!peer) {
            const currentStream = localStreamRef.current || stream;
            peer = addPeer(payload.caller, currentStream);
            peersRef.current[payload.caller] = peer;
            setPeers(prev => {
              if (prev.find(p => p.peerId === payload.caller)) return prev;
              return [...prev, { peerId: payload.caller, peer, userName: payload.userName }];
            });
          }
          
          if (!peer.destroyed) {
            try { peer.signal(payload.signal); } catch (e) { console.warn('Signal error:', e); }
          }
        });

        // 9. 退出
        socketRef.current.on('user-disconnected', (userId: string) => {
          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
            setPeers(prev => prev.filter(p => p.peerId !== userId));
          }
        });
      } catch (err) {
        console.error('Failed to get local stream', err);
        alert('カメラ、またはマイクへのアクセスが拒否されました。実際のマイクデバイスを選択してください。');
      }
    };

    initializeMedia();

    return () => {
      // クリーンアップ
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (localStreamRef.current && localStreamRef.current !== currentStream) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.keys(peersRef.current).forEach(key => {
        if (peersRef.current[key]) {
          peersRef.current[key].destroy();
        }
      });
      peersRef.current = {};
      setPeers([]);
      setLocalStream(null);
      localStreamRef.current = null;
    };
  }, [roomId]);

  // Peer作成（自分が発信する場合）
  const createPeer = (targetUserId: string, callerId: string, stream: MediaStream) => {
    console.log('[createPeer] Creating peer for:', targetUserId, {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioEnabled: stream.getAudioTracks()[0]?.enabled
    });

    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream,
      channelName: 'status', // DataChannelを作成
    });

    peer.on('error', err => {
      console.warn('createPeer Error:', err);
    });

    peer.on('signal', signal => {
      console.log('[createPeer] Sending signal to:', targetUserId, signal.type);
      socketRef.current?.emit('signal', { target: targetUserId, caller: callerId, signal });
    });

    peer.on('stream', userStream => {
      console.log('[createPeer] Received stream from:', targetUserId, {
        audioTracks: userStream.getAudioTracks().length,
        videoTracks: userStream.getVideoTracks().length
      });
      updatePeerStream(targetUserId, userStream);
    });

    // DataChannelでメッセージを受信
    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[DataChannel] Received from:', targetUserId, message);
        
        if (message.type === 'status') {
          updatePeerTrackState(targetUserId, 'audio', message.audio);
          updatePeerTrackState(targetUserId, 'video', message.video);
        }
      } catch (err) {
        console.warn('[DataChannel] Parse error:', err);
      }
    });

    // 接続確立後、自分の状態を送信
    peer.on('connect', () => {
      console.log('[DataChannel] Connected to:', targetUserId);
      // 現在のストリームから状態を取得
      const currentStream = localStreamRef.current;
      const audioEnabled = currentStream?.getAudioTracks()[0]?.enabled ?? true;
      const videoEnabled = currentStream?.getVideoTracks()[0]?.enabled ?? true;
      sendStatusToPeer(peer, audioEnabled, videoEnabled);
    });

    return peer;
  };

  // Peer追加（Offerを受け取った場合）
  const addPeer = (callerId: string, stream: MediaStream) => {
    console.log('[addPeer] Adding peer for:', callerId, {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioEnabled: stream.getAudioTracks()[0]?.enabled
    });

    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream,
    });

    peer.on('error', err => {
      console.warn('addPeer Error:', err);
    });

    peer.on('signal', signal => {
      console.log('[addPeer] Sending signal to:', callerId, signal.type);
      socketRef.current?.emit('signal', { target: callerId, caller: socketRef.current?.id, signal });
    });

    peer.on('stream', userStream => {
      console.log('[addPeer] Received stream from:', callerId, {
        audioTracks: userStream.getAudioTracks().length,
        videoTracks: userStream.getVideoTracks().length
      });
      updatePeerStream(callerId, userStream);
    });

    // DataChannelでメッセージを受信
    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[DataChannel] Received from:', callerId, message);
        
        if (message.type === 'status') {
          updatePeerTrackState(callerId, 'audio', message.audio);
          updatePeerTrackState(callerId, 'video', message.video);
        }
      } catch (err) {
        console.warn('[DataChannel] Parse error:', err);
      }
    });

    // 接続確立後、自分の状態を送信
    peer.on('connect', () => {
      console.log('[DataChannel] Connected to:', callerId);
      // 現在のストリームから状態を取得
      const currentStream = localStreamRef.current;
      const audioEnabled = currentStream?.getAudioTracks()[0]?.enabled ?? true;
      const videoEnabled = currentStream?.getVideoTracks()[0]?.enabled ?? true;
      sendStatusToPeer(peer, audioEnabled, videoEnabled);
    });

    return peer;
  };

  // ストリームが届いたらStateを更新して描画させる
  const updatePeerStream = (peerId: string, stream: MediaStream) => {
    console.log('[updatePeerStream] Updating stream for:', peerId);
    
    setPeers(prev => {
      const exists = prev.find(p => p.peerId === peerId);
      console.log('[updatePeerStream] Existing peer:', exists);
      
      if (exists) {
        // 既存のPeerの場合、状態は保持してストリームのみ更新
        const updated = prev.map(p => {
          if (p.peerId === peerId) {
            console.log('[updatePeerStream] Preserving state:', {
              isAudioEnabled: p.isAudioEnabled,
              isVideoEnabled: p.isVideoEnabled
            });
            return { 
              ...p, 
              stream
            };
          }
          return p;
        });
        return updated;
      } else {
        // 新規Peerの場合、初期値を設定（DataChannelで更新される）
        console.log('[updatePeerStream] New peer, initial state: audio=true, video=true');
        return [...prev, { 
          peerId, 
          peer: peersRef.current[peerId], 
          stream,
          isAudioEnabled: true,
          isVideoEnabled: true
        }];
      }
    });
  };

  // Peerのトラック状態を更新
  const updatePeerTrackState = (peerId: string, trackType: 'audio' | 'video', enabled: boolean) => {
    console.log('[updatePeerTrackState]', peerId, trackType, enabled);
    setPeers(prev => prev.map(p => {
      if (p.peerId === peerId) {
        if (trackType === 'audio') {
          return { ...p, isAudioEnabled: enabled };
        } else {
          return { ...p, isVideoEnabled: enabled };
        }
      }
      return p;
    }));
  };

  // DataChannelで状態を送信
  const sendStatusToPeer = (peer: Peer.Instance, audio: boolean, video: boolean) => {
    if (peer && !peer.destroyed) {
      const message = JSON.stringify({
        type: 'status',
        audio,
        video
      });
      try {
        peer.send(message);
        console.log('[DataChannel] Sent status:', { audio, video });
      } catch (err) {
        console.warn('[DataChannel] Send error:', err);
      }
    }
  };

  // 全てのPeerに状態を送信
  const broadcastStatus = (audio: boolean, video: boolean) => {
    Object.values(peersRef.current).forEach(peer => {
      sendStatusToPeer(peer, audio, video);
    });
  };

  // マイクデバイスの切り替え
  const changeAudioDevice = async (deviceId: string) => {
    if (!deviceId) return; // デバイスIDがない場合は処理しない
    
    try {
      // 指定したマイクデバイスで音声ストリームのみ再取得
      // exactを指定するとOverconstrainedErrorになる環境（Chrome等）があるため緩める
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
          
          // 全ての接続先Peerに対してTrackを差し替える
          Object.values(peersRef.current).forEach(peer => {
            if (!peer.destroyed) {
              peer.replaceTrack(oldAudioTrack, newAudioTrack, localStreamRef.current!);
            }
          });
        }
        
        localStreamRef.current.addTrack(newAudioTrack);
        
        // ミュート状態を引き継ぐ
        newAudioTrack.enabled = isAudioEnabled;
        
        // Reactの再描画をトリガーするために新しいMediaStreamオブジェクトを作成してセット
        const updatedStream = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(updatedStream);
        localStreamRef.current = updatedStream;
        
        setSelectedAudioDeviceId(deviceId);
        setShowAudioMenu(false);
      }
    } catch (err) {
      console.error('Failed to change audio device:', err);
      alert('マイクの切り替えに失敗しました。権限等をご確認ください。');
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('[toggleAudio] Audio track enabled:', audioTrack.enabled);
        
        // DataChannelで全てのPeerに状態を送信（現在の値を使用）
        broadcastStatus(audioTrack.enabled, videoTrack?.enabled ?? true);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        
        // DataChannelで全てのPeerに状態を送信（現在の値を使用）
        broadcastStatus(audioTrack?.enabled ?? true, videoTrack.enabled);
      }
    }
  };

  // スピーカーのミュート切り替え
  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerEnabled;
    setIsSpeakerEnabled(newSpeakerState);
    
    // すべてのビデオ要素（自分以外）のミュート状態を変更
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((videoElement) => {
      // 自分のビデオ（muted属性がtrueのもの）は除外
      if (!videoElement.muted) {
        (videoElement as HTMLVideoElement).muted = !newSpeakerState;
      }
    });
    
    console.log('[toggleSpeaker] Speaker enabled:', newSpeakerState);
  };

  // スピーカーデバイスの切り替え
  const changeOutputDevice = async (deviceId: string) => {
    if (!deviceId) return;
    
    try {
      // すべてのビデオ要素の出力デバイスを変更
      const videoElements = document.querySelectorAll('video');
      
      for (const videoElement of Array.from(videoElements)) {
        // HTMLMediaElement.setSinkId() を使用して出力デバイスを変更
        if ('setSinkId' in videoElement && typeof (videoElement as any).setSinkId === 'function') {
          await (videoElement as any).setSinkId(deviceId);
          console.log('[changeOutputDevice] Changed output device for video element to:', deviceId);
        }
      }
      
      setSelectedOutputDeviceId(deviceId);
      setShowOutputMenu(false);
    } catch (err) {
      console.error('Failed to change output device:', err);
      alert('スピーカーの切り替えに失敗しました。ブラウザがこの機能をサポートしているか確認してください。');
    }
  };

  return (
    <div className="room-container">
      <div className="room-header">
        <h2>Room: {roomId}</h2>
        <div style={{ color: 'var(--text-muted)' }}>
          {peers.length + 1} users connected
        </div>
      </div>

      <div className="video-grid">
        {/* 自分 */}
        {localStream && (
          <VideoPlayer 
            stream={localStream} 
            isLocal 
            label={userName}
            outputDeviceId={selectedOutputDeviceId} 
            isSpeakerEnabled={isSpeakerEnabled}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
          />
        )}
        
        {/* 他参加者 */}
        {peers.map((peer, idx) => (
          <VideoPlayer 
            key={peer.peerId} 
            stream={peer.stream || null} 
            label={peer.userName || `User ${idx + 1}`}
            outputDeviceId={selectedOutputDeviceId}
            isSpeakerEnabled={isSpeakerEnabled}
            isAudioEnabled={peer.isAudioEnabled ?? true}
            isVideoEnabled={peer.isVideoEnabled ?? true}
          />
        ))}
      </div>

      <div className="controls-bar">
        <div className="control-group">
          <div className="control-btn-wrapper">
            {localStream && (
              <div 
                className="visualizer-underlay"
                style={{
                  opacity: isAudioEnabled ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  pointerEvents: 'none'
                }}
              >
                <AudioVisualizer stream={localStream} isLocal />
              </div>
            )}
            <button 
              className={`icon ${!isAudioEnabled ? 'active' : ''}`} 
              onClick={toggleAudio}
              title="Toggle Mic"
              style={{ zIndex: 1 }}
            >
              {isAudioEnabled ? <Mic /> : <MicOff />}
            </button>
          </div>
          
          {/* マイク選択ドロップダウン用ボタン */}
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
                {audioDevices.length > 0 ? (
                  audioDevices.map((device, idx) => (
                    <div 
                      key={device.deviceId || String(idx)} 
                      className={`device-menu-item ${device.deviceId === selectedAudioDeviceId ? 'selected' : ''}`}
                      onClick={() => changeAudioDevice(device.deviceId)}
                    >
                      {device.label || `Microphone ${idx + 1}`}
                    </div>
                  ))
                ) : (
                  <div className="device-menu-item" style={{ opacity: 0.5 }}>No devices found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <button 
          className={`icon ${!isVideoEnabled ? 'active' : ''}`} 
          onClick={toggleVideo}
          title="Toggle Video"
        >
          {isVideoEnabled ? <Video /> : <VideoOff />}
        </button>

        {/* スピーカー選択 */}
        <div className="control-group">
          <div className="control-btn-wrapper">
            <button 
              className={`icon ${!isSpeakerEnabled ? 'active' : ''}`} 
              onClick={toggleSpeaker}
              title="Toggle Speaker"
              style={{ zIndex: 1 }}
            >
              {isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
            </button>
          </div>
          
          {/* スピーカー選択ドロップダウン */}
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
                {audioOutputDevices.length > 0 ? (
                  audioOutputDevices.map((device, idx) => (
                    <div 
                      key={device.deviceId || String(idx)} 
                      className={`device-menu-item ${device.deviceId === selectedOutputDeviceId ? 'selected' : ''}`}
                      onClick={() => changeOutputDevice(device.deviceId)}
                    >
                      {device.label || `Speaker ${idx + 1}`}
                    </div>
                  ))
                ) : (
                  <div className="device-menu-item" style={{ opacity: 0.5 }}>No devices found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <button 
          className="icon active" 
          onClick={onLeave}
          style={{ width: 'auto', padding: '0 24px', borderRadius: '24px' }}
          title="Leave Room"
        >
          <PhoneOff />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>退出する</span>
        </button>
      </div>
    </div>
  );
};

export default Room;
