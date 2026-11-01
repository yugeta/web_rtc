import React, { useEffect, useRef } from 'react';

interface ScreenShareViewProps {
  stream: MediaStream;
  userName: string;
}

const ScreenShareView: React.FC<ScreenShareViewProps> = ({ stream, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="screen-share-wrapper">
      <video ref={videoRef} autoPlay playsInline />
      <div className="screen-share-label">
        {userName} の画面共有
      </div>
    </div>
  );
};

export default ScreenShareView;
