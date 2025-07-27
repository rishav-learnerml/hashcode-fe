import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://hashtalk.swagcoder.in'); // your server

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to signaling server');
      socket.emit('join-room');
    });

    socket.on('match-found', async ({ offer }) => {
      console.log('Match found! Setting remote offer...');
      setMatched(true);

      peerConnection.current = createPeerConnection();

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit('returning-signal', { answer });
    });

    socket.on('sending-signal', async ({ offer }) => {
      console.log('Received offer from remote peer');
      peerConnection.current = createPeerConnection();

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit('returning-signal', { answer });
    });

    socket.on('answer-received', async ({ answer }) => {
      console.log('Answer received');
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      console.log('ICE candidate received');
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    getUserMedia();

    return () => {
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
      for (const track of tracks) {
        pc.addTrack(track, localVideoRef.current.srcObject as MediaStream);
      }
    }

    return pc;
  };

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to get local stream', error);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 space-y-4">
      <video ref={localVideoRef} autoPlay muted className="w-1/2 rounded-lg border" />
      <video ref={remoteVideoRef} autoPlay className="w-1/2 rounded-lg border" />
      {!matched && <p>Waiting for a match...</p>}
    </div>
  );
};

export default Match;
