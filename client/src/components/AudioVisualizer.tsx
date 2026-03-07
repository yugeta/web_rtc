import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream;
  isLocal?: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isLocal = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // 初回のAudioContextとAnalyserの初期化（コンポーネント生存中は1つを維持）
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    console.log('[AudioVisualizer] AudioContext created, state:', ctx.state);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const resumeContext = () => {
      if (ctx.state === 'suspended') {
        console.log('[AudioVisualizer] Resuming suspended AudioContext');
        ctx.resume().then(() => {
          console.log('[AudioVisualizer] AudioContext resumed, state:', ctx.state);
        }).catch(err => {
          console.warn('[AudioVisualizer] Failed to resume AudioContext:', err);
        });
      }
    };

    // ユーザー操作時に強制再開
    window.addEventListener('click', resumeContext);
    window.addEventListener('touchstart', resumeContext);
    
    // 初回も試みる
    resumeContext();

    // 描画ループ
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    if (canvas && canvasCtx) {
      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = 24; 
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(dataArray[i] - 128);
        }
        const average = sum / bufferLength;
        const volumeScale = 1 + (average / 64);
        const currentRadius = baseRadius * volumeScale;

        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI);
        canvasCtx.fillStyle = isLocal ? 'rgba(74, 222, 128, 0.3)' : 'rgba(96, 165, 250, 0.3)';
        canvasCtx.fill();
        
        // デバッグ用: Contextがsuspendedの時は赤い点を表示してハング状態を可視化（不要なら削除）
        // if (ctx.state === 'suspended') {
        //   canvasCtx.fillStyle = 'red';
        //   canvasCtx.fillRect(centerX - 2, centerY - 2, 4, 4);
        // }
      };
      draw();
    }

    return () => {
      window.removeEventListener('click', resumeContext);
      window.removeEventListener('touchstart', resumeContext);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (ctx.state !== 'closed') ctx.close().catch(console.warn);
    };
  }, [isLocal]);

  // streamが変更されたときにソースだけを繋ぎ直す (AudioContextは破棄しない)
  useEffect(() => {
    const ctx = audioContextRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser || !stream) return;

    console.log('[AudioVisualizer] Stream changed:', {
      audioTracks: stream.getAudioTracks().length,
      audioTrackLabel: stream.getAudioTracks()[0]?.label,
      audioTrackEnabled: stream.getAudioTracks()[0]?.enabled,
      contextState: ctx.state
    });

    // 前のソースがあれば切断
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // 新しいストリームにAudioTrackが含まれていれば接続
    if (stream.getAudioTracks().length > 0) {
      try {
        // Chromeでは同じMediaStreamから複数のMediaStreamSourceを作成できないため
        // トラックをクローンして新しいMediaStreamを作成する
        const audioTrack = stream.getAudioTracks()[0];
        const clonedTrack = audioTrack.clone();
        const audioOnlyStream = new MediaStream([clonedTrack]);
        
        console.log('[AudioVisualizer] Created cloned track:', {
          originalEnabled: audioTrack.enabled,
          clonedEnabled: clonedTrack.enabled,
          clonedLabel: clonedTrack.label
        });
        
        const connectSource = () => {
          if (ctx.state === 'running') {
            try {
              const source = ctx.createMediaStreamSource(audioOnlyStream);
              source.connect(analyser);
              sourceRef.current = source;
              console.log('[AudioVisualizer] Audio source connected successfully');
            } catch (err) {
              console.warn('Audio connection error:', err);
            }
          } else {
            console.log('[AudioVisualizer] Context not running, waiting...', ctx.state);
            const onStateChange = () => {
              if (ctx.state === 'running') {
                ctx.removeEventListener('statechange', onStateChange);
                connectSource();
              }
            };
            ctx.addEventListener('statechange', onStateChange);
          }
        };

        connectSource();
      } catch (err) {
        console.warn('Failed to prepare Audio Source:', err);
      }
    }

    // クリーンアップ：ストリームが切り替わる際に古いsourceを切断し、クローンしたトラックも停止
    return () => {
      if (sourceRef.current) {
        // クローンしたトラックを停止
        const mediaStream = sourceRef.current.mediaStream;
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [stream]);

  return (
    <canvas 
      ref={canvasRef} 
      width={64} 
      height={64} 
      className="audio-visualizer-circle"
    />
  );
};

export default AudioVisualizer;
