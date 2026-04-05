import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronUp, Volume2, VolumeX, Monitor, MonitorOff, Menu, X, MessageSquare } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import ScreenShareView from './ScreenShareView';
import ChatPanel from './ChatPanel';
import { useHeader } from '../contexts/HeaderContext';

interface RoomProps {
  roomId: string;
  roomName?: string;
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
  screenStream?: MediaStream;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  userName?: string;
  dataChannel?: RTCDataChannel;
}

type DataChannelMessage =
  | { type: 'status'; audio: boolean; video: boolean }
  | { type: 'screen-share'; sharing: boolean; userName?: string };

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.mynt.work:3478' },
  { urls: 'turn:stun.mynt.work:3478', username: 'mynt', credential: 'myntpass' },
  { urls: 'turns:stun.mynt.work:5349', username: 'mynt', credential: 'myntpass' },
];

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
        className={isLocal ? 'video-mirror' : ''}
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

const Room: React.FC<RoomProps> = ({ roomId, roomName, userName, initialSettings, onLeave }) => {
  const { setCenter } = useHeader();
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialSettings?.isVideoEnabled ?? true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialSettings?.isAudioEnabled ?? true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(initialSettings?.isSpeakerEnabled ?? true);
  
  // デバイス選択用のState
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(initialSettings?.audioDeviceId || '');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  
  // カメラ選択用のState
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>(initialSettings?.videoDeviceId || '');
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  
  // スピーカー選択用のState
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>(initialSettings?.outputDeviceId || '');

  // 画面共有関連のState
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUserId, setScreenSharingUserId] = useState<string | null>(null);
  const [screenSharingUserName, setScreenSharingUserName] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const roomStartedAtRef = useRef<string | null>(null);
  const isScreenShareSupported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [socketId: string]: Peer.Instance }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

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
        const updatedVideoInputs = updatedDevices.filter(d => d.kind === 'videoinput');
        const updatedAudioOutputs = updatedDevices.filter(d => d.kind === 'audiooutput');
        
        setAudioDevices(updatedAudioInputs);
        setVideoDevices(updatedVideoInputs);
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

        // デフォルトのビデオデバイスを設定
        if (initialSettings?.videoDeviceId) {
          setSelectedVideoDeviceId(initialSettings.videoDeviceId);
        } else if (updatedVideoInputs.length > 0) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.getSettings().deviceId) {
            setSelectedVideoDeviceId(videoTrack.getSettings().deviceId!);
          } else {
            setSelectedVideoDeviceId(updatedVideoInputs[0].deviceId);
          }
        }

        // 2. Socket接続
        const token = localStorage.getItem('auth_token');
        socketRef.current = io(SERVER_URL, {
          auth: token ? { token } : undefined,
        });

        // 3. ルーム参加（ユーザー名も送信）
        socketRef.current.emit('join-room', { roomId, userName });

        // Room 開始時刻を受信
        socketRef.current.on('room-started-at', (startedAt: string) => {
          roomStartedAtRef.current = startedAt;
        });

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
          // 画面共有中のユーザーが退出した場合のクリーンアップ
          setScreenSharingUserId(prev => {
            if (prev === userId) {
              setScreenSharingUserName(null);
              return null;
            }
            return prev;
          });

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
      // 画面共有ストリームのクリーンアップ
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
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

  // 経過時間カウントアップ
  useEffect(() => {
    const timer = setInterval(() => {
      const startedAt = roomStartedAtRef.current;
      if (!startedAt) return;
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      if (diff < 0) return;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      setElapsedTime(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ヘッダーの center にRoom情報を表示
  useEffect(() => {
    setCenter(
      <>
        <span>{roomName || roomId}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {elapsedTime}</span>
        <span>👤 {peers.length + 1}</span>
      </>
    );
    return () => setCenter(null);
  }, [roomName, roomId, elapsedTime, peers.length, setCenter]);

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
      config: { iceServers: ICE_SERVERS },
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
      // 画面共有ストリームの判定: 音声トラックがなく映像トラックのみ
      if (userStream.getAudioTracks().length === 0 && userStream.getVideoTracks().length > 0) {
        setPeers(prev => prev.map(p =>
          p.peerId === targetUserId ? { ...p, screenStream: userStream } : p
        ));
      } else {
        updatePeerStream(targetUserId, userStream);
      }
    });

    // DataChannelでメッセージを受信
    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString()) as DataChannelMessage;
        console.log('[DataChannel] Received from:', targetUserId, message);
        
        if (message.type === 'status') {
          updatePeerTrackState(targetUserId, 'audio', message.audio);
          updatePeerTrackState(targetUserId, 'video', message.video);
        } else if (message.type === 'screen-share') {
          if (message.sharing) {
            setScreenSharingUserId(targetUserId);
            setScreenSharingUserName(message.userName || null);
          } else {
            setScreenSharingUserId(null);
            setScreenSharingUserName(null);
            setPeers(prev => prev.map(p =>
              p.peerId === targetUserId ? { ...p, screenStream: undefined } : p
            ));
          }
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
      // 自分が画面共有中なら新しいPeerにも通知
      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          try {
            peer.addTrack(screenTrack, screenStreamRef.current);
          } catch (err) {
            console.warn('[ScreenShare] Failed to add screen track to new peer:', err);
          }
        }
        try {
          peer.send(JSON.stringify({ type: 'screen-share', sharing: true, userName } satisfies DataChannelMessage));
        } catch (err) {
          console.warn('[DataChannel] Failed to send screen share status to new peer:', err);
        }
      }
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
      config: { iceServers: ICE_SERVERS },
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
      // 画面共有ストリームの判定: 音声トラックがなく映像トラックのみ
      if (userStream.getAudioTracks().length === 0 && userStream.getVideoTracks().length > 0) {
        setPeers(prev => prev.map(p =>
          p.peerId === callerId ? { ...p, screenStream: userStream } : p
        ));
      } else {
        updatePeerStream(callerId, userStream);
      }
    });

    // DataChannelでメッセージを受信
    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString()) as DataChannelMessage;
        console.log('[DataChannel] Received from:', callerId, message);
        
        if (message.type === 'status') {
          updatePeerTrackState(callerId, 'audio', message.audio);
          updatePeerTrackState(callerId, 'video', message.video);
        } else if (message.type === 'screen-share') {
          if (message.sharing) {
            setScreenSharingUserId(callerId);
            setScreenSharingUserName(message.userName || null);
          } else {
            setScreenSharingUserId(null);
            setScreenSharingUserName(null);
            setPeers(prev => prev.map(p =>
              p.peerId === callerId ? { ...p, screenStream: undefined } : p
            ));
          }
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
      // 自分が画面共有中なら新しいPeerにも通知
      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          try {
            peer.addTrack(screenTrack, screenStreamRef.current);
          } catch (err) {
            console.warn('[ScreenShare] Failed to add screen track to new peer:', err);
          }
        }
        try {
          peer.send(JSON.stringify({ type: 'screen-share', sharing: true, userName } satisfies DataChannelMessage));
        } catch (err) {
          console.warn('[DataChannel] Failed to send screen share status to new peer:', err);
        }
      }
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

  // 全てのPeerに画面共有状態を送信
  const broadcastScreenShareStatus = (sharing: boolean, sharingUserName?: string) => {
    const message = JSON.stringify({
      type: 'screen-share',
      sharing,
      userName: sharingUserName
    } satisfies DataChannelMessage);

    Object.values(peersRef.current).forEach(peer => {
      if (peer && !peer.destroyed) {
        try {
          peer.send(message);
        } catch (err) {
          console.warn('[DataChannel] Screen share status send error:', err);
        }
      }
    });
  };

  // 画面共有の開始
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });

      const screenTrack = stream.getVideoTracks()[0];

      // ブラウザの「共有を停止」ボタン対応
      screenTrack.onended = () => {
        stopScreenShare();
      };

      // 全Peerに画面共有トラックを追加
      Object.values(peersRef.current).forEach(peer => {
        if (!peer.destroyed) {
          try {
            peer.addTrack(screenTrack, stream);
          } catch (err) {
            console.warn('[ScreenShare] Failed to add track to peer:', err);
          }
        }
      });

      // DataChannelで画面共有開始を通知
      broadcastScreenShareStatus(true, userName);

      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      setScreenSharingUserId(socketRef.current?.id || null);
      setScreenSharingUserName(userName);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return;
      }
      console.error('Failed to start screen sharing:', err);
      alert('画面共有の開始に失敗しました');
    }
  };

  // 画面共有の停止
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];

      // 全トラックを停止
      screenStreamRef.current.getTracks().forEach(track => track.stop());

      // 全Peerから画面共有トラックを削除
      if (screenTrack) {
        Object.values(peersRef.current).forEach(peer => {
          if (!peer.destroyed) {
            try {
              peer.removeTrack(screenTrack, screenStreamRef.current!);
            } catch (err) {
              console.warn('[ScreenShare] Failed to remove track from peer:', err);
            }
          }
        });
      }

      // DataChannelで画面共有停止を通知
      broadcastScreenShareStatus(false);

      setScreenStream(null);
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      setScreenSharingUserId(null);
      setScreenSharingUserName(null);
    }
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

  // カメラデバイスの切り替え
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
          
          // 全ての接続先Peerに対してTrackを差し替える
          Object.values(peersRef.current).forEach(peer => {
            if (!peer.destroyed) {
              peer.replaceTrack(oldVideoTrack, newVideoTrack, localStreamRef.current!);
            }
          });
          
          oldVideoTrack.stop();
        }
        
        localStreamRef.current.addTrack(newVideoTrack);
        
        // ミュート状態を引き継ぐ
        newVideoTrack.enabled = isVideoEnabled;
        
        // Reactの再描画をトリガー
        const updatedStream = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(updatedStream);
        localStreamRef.current = updatedStream;
        
        setSelectedVideoDeviceId(deviceId);
        setShowVideoMenu(false);
      }
    } catch (err) {
      console.error('Failed to change video device:', err);
      alert('カメラの切り替えに失敗しました。権限等をご確認ください。');
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
    } catch (err) {
      console.error('Failed to change output device:', err);
      alert('スピーカーの切り替えに失敗しました。ブラウザがこの機能をサポートしているか確認してください。');
    }
  };

  return (
    <div className="room-container">

      <div className="room-content">
        <div className={`video-grid ${screenSharingUserId ? 'with-screen-share' : ''}`} data-count={peers.length + 1}>
          {/* 画面共有表示 */}
          {screenSharingUserId && (() => {
            // 自分が共有中の場合はローカルのscreenStream、他者の場合はPeerのscreenStream
            const isLocalSharing = screenSharingUserId === socketRef.current?.id;
            const shareStream = isLocalSharing
              ? screenStream
              : peers.find(p => p.peerId === screenSharingUserId)?.screenStream || null;
            
            return shareStream ? (
              <ScreenShareView
                stream={shareStream}
                userName={screenSharingUserName || ''}
              />
            ) : null;
          })()}

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
        <ChatPanel
          socket={socketRef.current}
          userName={userName}
          isOpen={isChatOpen}
          onUnreadCountChange={setUnreadCount}
          onClose={() => setIsChatOpen(false)}
        />
      </div>

      <div className="controls-bar">
        {/* デスクトップ用コントロール（スマホでは非表示） */}
        <div className="desktop-controls">
          {/* グループ1: デバイス設定 */}
          <div className="controls-group-devices">
            {/* Mic ボタン + 統合デバイス選択メニュー */}
            <div className="control-group">
              <div className="control-btn-wrapper">
                {localStream && (
                  <div 
                    className="visualizer-underlay"
                    data-active={isAudioEnabled}
                  >
                    <AudioVisualizer stream={localStream} isLocal />
                  </div>
                )}
                <button 
                  className={`icon ${!isAudioEnabled ? 'active' : ''}`} 
                  onClick={toggleAudio}
                  title="Toggle Mic"
                >
                  {isAudioEnabled ? <Mic /> : <MicOff />}
                </button>
              </div>
              
              <div>
                <button 
                  className="icon-small" 
                  onClick={() => { setShowAudioMenu(!showAudioMenu); setShowVideoMenu(false); }}
                  title="Audio Settings"
                >
                  <ChevronUp size={16} />
                </button>
                
                {showAudioMenu && (
                  <div className="device-menu">
                    <div className="device-menu-title">マイク</div>
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
                      <div className="device-menu-item empty">No devices found</div>
                    )}
                    <div className="device-menu-divider" />
                    <div className="device-menu-title">スピーカー</div>
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
                      <div className="device-menu-item empty">No devices found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Speaker ミュートボタン（デバイス選択なし） */}
            <button 
              className={`icon icon-small-standalone ${!isSpeakerEnabled ? 'active' : ''}`} 
              onClick={toggleSpeaker}
              title="Toggle Speaker"
            >
              {isSpeakerEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Video ボタン + カメラ選択メニュー */}
            <div className="control-group">
              <div className="control-btn-wrapper">
                <button 
                  className={`icon ${!isVideoEnabled ? 'active' : ''}`} 
                  onClick={toggleVideo}
                  title="Toggle Video"
                >
                  {isVideoEnabled ? <Video /> : <VideoOff />}
                </button>
              </div>
              
              <div>
                <button 
                  className="icon-small" 
                  onClick={() => { setShowVideoMenu(!showVideoMenu); setShowAudioMenu(false); }}
                  title="Select Camera"
                >
                  <ChevronUp size={16} />
                </button>
                
                {showVideoMenu && (
                  <div className="device-menu">
                    <div className="device-menu-title">カメラ</div>
                    {videoDevices.length > 0 ? (
                      videoDevices.map((device, idx) => (
                        <div 
                          key={device.deviceId || String(idx)} 
                          className={`device-menu-item ${device.deviceId === selectedVideoDeviceId ? 'selected' : ''}`}
                          onClick={() => changeVideoDevice(device.deviceId)}
                        >
                          {device.label || `Camera ${idx + 1}`}
                        </div>
                      ))
                    ) : (
                      <div className="device-menu-item empty">No devices found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* グループ2: シェア機能 */}
          <div className="controls-group-share">
            {isScreenShareSupported && (
              <button
                className={`icon ${isScreenSharing ? 'active' : ''}`}
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                disabled={!!(screenSharingUserId && screenSharingUserId !== socketRef.current?.id)}
                data-disabled={!!(screenSharingUserId && screenSharingUserId !== socketRef.current?.id)}
                title={
                  screenSharingUserId && screenSharingUserId !== socketRef.current?.id
                    ? '他の参加者が画面共有中です'
                    : isScreenSharing
                      ? '共有を停止'
                      : '画面を共有'
                }
              >
                {isScreenSharing ? <MonitorOff /> : <Monitor />}
              </button>
            )}

            <div className="control-btn-wrapper">
              <button 
                className={`icon ${isChatOpen ? 'active' : ''}`}
                onClick={() => setIsChatOpen(!isChatOpen)}
                title="Chat"
              >
                <MessageSquare />
                {unreadCount > 0 && (
                  <span className="chat-badge">{unreadCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* モバイル用ハンバーガーボタン（スマホでのみ表示） */}
        <button 
          className="icon mobile-menu-btn"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          title="メニュー"
        >
          {showMobileMenu ? <X /> : <Menu />}
        </button>

        {/* モバイル用画面共有ボタン（スマホでのみ表示） */}
        {isScreenShareSupported && (
          <button
            className={`icon mobile-share-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={!!(screenSharingUserId && screenSharingUserId !== socketRef.current?.id)}
            data-disabled={!!(screenSharingUserId && screenSharingUserId !== socketRef.current?.id)}
            title={isScreenSharing ? '共有を停止' : '画面共有'}
          >
            {isScreenSharing ? <MonitorOff /> : <Monitor />}
          </button>
        )}

        {/* モバイル用チャットボタン（スマホでのみ表示） */}
        <button 
          className={`icon mobile-chat-btn ${isChatOpen ? 'active' : ''}`}
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="チャット"
        >
          <MessageSquare />
          {unreadCount > 0 && (
            <span className="chat-badge">{unreadCount}</span>
          )}
        </button>

        <button 
          className="icon active leave-btn" 
          onClick={() => setShowLeaveConfirm(true)}
          title="Leave Room"
        >
          <PhoneOff />
          <span className="leave-btn-text">退出する</span>
        </button>
      </div>

      {/* モバイルメニューパネル */}
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu-panel" onClick={e => e.stopPropagation()}>
            {/* マイク */}
            <div className="mobile-menu-item">
              <button 
                className={`icon ${!isAudioEnabled ? 'active' : ''}`} 
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic /> : <MicOff />}
              </button>
              <span className="mobile-menu-label">マイク</span>
              {audioDevices.length > 1 && (
                <select 
                  className="mobile-device-select"
                  value={selectedAudioDeviceId}
                  onChange={e => changeAudioDevice(e.target.value)}
                >
                  {audioDevices.map((device, idx) => (
                    <option key={device.deviceId || String(idx)} value={device.deviceId}>
                      {device.label || `Microphone ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* スピーカー */}
            <div className="mobile-menu-item">
              <button 
                className={`icon ${!isSpeakerEnabled ? 'active' : ''}`} 
                onClick={toggleSpeaker}
              >
                {isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
              </button>
              <span className="mobile-menu-label">スピーカー</span>
              {audioOutputDevices.length > 1 && (
                <select 
                  className="mobile-device-select"
                  value={selectedOutputDeviceId}
                  onChange={e => changeOutputDevice(e.target.value)}
                >
                  {audioOutputDevices.map((device, idx) => (
                    <option key={device.deviceId || String(idx)} value={device.deviceId}>
                      {device.label || `Speaker ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* カメラ */}
            <div className="mobile-menu-item">
              <button 
                className={`icon ${!isVideoEnabled ? 'active' : ''}`} 
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video /> : <VideoOff />}
              </button>
              <span className="mobile-menu-label">カメラ</span>
              {videoDevices.length > 1 && (
                <select 
                  className="mobile-device-select"
                  value={selectedVideoDeviceId}
                  onChange={e => changeVideoDevice(e.target.value)}
                >
                  {videoDevices.map((device, idx) => (
                    <option key={device.deviceId || String(idx)} value={device.deviceId}>
                      {device.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 画面共有はコントロールバーに移動済み */}
          </div>
        </div>
      )}

      {/* 退出確認モーダル */}
      {showLeaveConfirm && (
        <div className="leave-modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="leave-modal" onClick={e => e.stopPropagation()}>
            <p className="leave-modal-title">ルームを退出しますか？</p>
            <p className="leave-modal-desc">通話から切断されます。</p>
            <div className="leave-modal-actions">
              <button
                className="leave-modal-cancel"
                onClick={() => setShowLeaveConfirm(false)}
              >
                キャンセル
              </button>
              <button
                className="danger leave-modal-confirm"
                onClick={onLeave}
              >
                退出する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;
