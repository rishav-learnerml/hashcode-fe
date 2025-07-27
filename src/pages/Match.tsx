import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("https://hashtalk.swagcoder.in");

const Match = () => {
  const [matched, setMatched] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    const roomId = "default"; // better to keep this fixed

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        streamRef.current = mediaStream;
        setStreamReady(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        socket.emit("join-room", { roomId });

        socket.on("match-found", ({ socketId }) => {
          console.log("Matched with", socketId);
          setMatched(true);

          const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: mediaStream,
          });

          peer.on("signal", (signal) => {
            socket.emit("sending-signal", {
              userToSignal: socketId,
              signal,
            });
          });

          peer.on("stream", (remoteStream) => {
            console.log("📹 Remote stream received");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          peerRef.current = peer;
        });

        socket.on("user-joined", ({ signal, callerId }) => {
          console.log("📞 Received signal from", callerId);

          const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: mediaStream,
          });

          peer.on("signal", (signal) => {
            socket.emit("returning-signal", {
              signal,
              callerId,
            });
          });

          peer.on("stream", (remoteStream) => {
            console.log("📹 Remote stream received (callee)");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          peer.signal(signal);
          peerRef.current = peer;
        });

        socket.on("receiving-returned-signal", ({ signal, id }) => {
          console.log("🎯 Receiving returned signal from", id);

          if (peerRef.current) {
            peerRef.current.signal(signal);
          } else {
            console.warn("⚠️ peerRef not ready. Delaying signal application.");

            // Wait and retry once
            setTimeout(() => {
              if (peerRef.current) {
                peerRef.current.signal(signal);
              } else {
                console.error("❌ Still no peerRef. Cannot apply signal.");
              }
            }, 500); // adjust if needed
          }
        });

        socket.on("user-disconnected", () => {
          console.log("❌ User disconnected");
          if (peerRef.current) {
            peerRef.current.destroy();
          }
          peerRef.current = null;
          setMatched(false);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        });
      });

    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  console.log(streamReady, "streamReady");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white space-y-4">
      <h1 className="text-2xl font-bold">
        {matched ? "🎉 Connected!" : "🔍 Finding a Match..."}
      </h1>
      <div className="flex gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-48 rounded-lg border"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-64 h-48 rounded-lg border"
        />
      </div>
    </div>
  );
};

export default Match;
