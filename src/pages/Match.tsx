// Match.tsx
import {  useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("https://hashtalk.swagcoder.in"); // ✅ use your deployed backend URL

const Match = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [matched, setMatched] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);


  console.log(stream)
  useEffect(() => {
    const roomId = crypto.randomUUID(); // or any static string for testing

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      socket.emit("join-room", { roomId });

      socket.on("match-found", ({ socketId }) => {
        console.log("Matched with", socketId);
        setMatched(true);

        const newPeer = new Peer({
          initiator: true,
          trickle: false,
          stream: mediaStream,
        });

        newPeer.on("signal", (signal) => {
          socket.emit("sending-signal", {
            userToSignal: socketId,
            signal,
          });
        });

        newPeer.on("stream", (remoteStream) => {
          console.log("📹 Remote stream received");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        setPeer(newPeer);
      });

      socket.on("user-joined", ({ signal, callerId }) => {
        const newPeer = new Peer({
          initiator: false,
          trickle: false,
          stream: mediaStream,
        });

        newPeer.on("signal", (signal) => {
          socket.emit("returning-signal", {
            signal,
            callerId,
          });
        });

        newPeer.on("stream", (remoteStream) => {
          console.log("📹 Remote stream received (non-initiator)");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        newPeer.signal(signal);
        setPeer(newPeer);
      });

      socket.on("receiving-returned-signal", ({ signal, id }) => {
        console.log(id)
        if (peer) {
          peer.signal(signal);
        }
      });

      socket.on("user-disconnected", () => {
        console.log("User disconnected");
        remoteVideoRef.current && (remoteVideoRef.current.srcObject = null);
        peer?.destroy();
        setPeer(null);
        setMatched(false);
      });
    });

    return () => {
      socket.disconnect();
      peer?.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white space-y-4">
      <h1 className="text-2xl font-bold">{matched ? "🎉 Connected!" : "🔍 Finding a Match..."}</h1>
      <div className="flex gap-4">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-64 h-48 rounded-lg border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-48 rounded-lg border" />
      </div>
    </div>
  );
};

export default Match;
