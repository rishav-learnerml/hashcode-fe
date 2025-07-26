import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const socket = io('https://hashtalk.swagcoder.in');

export default function Match() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState<string | null>(null);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);

  console.log(stream,receivingCall,caller,callerSignal)

  useEffect(() => {
    // Get camera and mic access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit('join-room', { roomId: 'hashtalk' });

      socket.on('match-found', ({ socketId }) => {
        console.log('Matched with:', socketId);
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream,
        });

        peer.on('signal', (data:any) => {
          socket.emit('sending-signal', {
            userToSignal: socketId,
            signal: data,
          });
        });

        peer.on('stream', (remoteStream:any) => {
          console.log('Received remote stream:', remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        socket.on('receiving-returned-signal', ({ signal }) => {
          setCallAccepted(true);
          peer.signal(signal);
        });

        peerRef.current = peer;
      });

      socket.on('user-joined', ({ signal, callerId }) => {
        setReceivingCall(true);
        setCaller(callerId);
        setCallerSignal(signal);

        const peer = new Peer({
          initiator: false,
          trickle: false,
          stream,
        });

        peer.on('signal', (data:any) => {
          socket.emit('returning-signal', {
            signal: data,
            callerId,
          });
        });

        peer.on('stream', (remoteStream:any) => {
          console.log('Received remote stream (callee):', remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        peer.signal(signal);
        peerRef.current = peer;
        setCallAccepted(true);
      });

      socket.on('user-disconnected', (id) => {
        console.log('User disconnected:', id);
        peerRef.current?.destroy();
        peerRef.current = null;
        setCallAccepted(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-1/2 rounded-xl border shadow"
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-1/2 rounded-xl border shadow"
      />
      {!callAccepted && <p>🕒 Waiting for match...</p>}
    </div>
  );
}
