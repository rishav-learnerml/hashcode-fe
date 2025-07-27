import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("https://hashtalk.swagcoder.in");

const Match = () => {
  const [matched, setMatched] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    const roomId = "default";

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        streamRef.current = mediaStream;
        setStreamReady(true);
        console.log("✅ Local stream ready");

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        socket.emit("join-room", { roomId });

        // ✅ MATCH FOUND
        socket.on("match-found", ({ socketId }) => {
          console.log("✅ Matched with:", socketId);

          if (!streamRef.current) {
            console.error("❌ Cannot create peer. Stream not available.");
            return;
          }

          const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: streamRef.current,
          });

          peer.on("signal", (signal) => {
            socket.emit("sending-signal", {
              userToSignal: socketId,
              signal,
            });
          });

          peer.on("stream", (remoteStream) => {
            const attachStream = () => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current
                  .play()
                  .catch((e) => console.error("play() failed", e));
              } else {
                setTimeout(attachStream, 100);
              }
            };
            attachStream();
          });

          peerRef.current = peer;
          setMatched(true);
          setRemoteUserId(socketId);
        });

        // ✅ USER JOINED HANDLER
        socket.on("user-joined", ({ signal, callerId }) => {
          console.log("📞 Incoming call from:", callerId);

          if (!streamRef.current) {
            console.error("❌ Cannot accept peer. Stream not available.");
            return;
          }

          const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: streamRef.current,
          });

          peer.on("signal", (signal) => {
            socket.emit("returning-signal", {
              signal,
              callerId,
            });
          });

          peer.on("stream", (remoteStream) => {
            const attachStream = () => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current
                  .play()
                  .catch((e) => console.error("play() failed", e));
              } else {
                setTimeout(attachStream, 100);
              }
            };
            attachStream();
          });

          try {
            peer.signal(signal);
          } catch (err) {
            console.error("❌ Error applying caller signal:", err);
          }

          peerRef.current = peer;
          setMatched(true);
          setRemoteUserId(callerId);
        });

        // ✅ RECEIVING RETURNED SIGNAL
        socket.on("receiving-returned-signal", ({ signal, id }) => {
          console.log("🔁 Got return signal from:", id);

          if (peerRef.current) {
            try {
              peerRef.current.signal(signal);
            } catch (err) {
              console.error("❌ Error applying returned signal:", err);
            }
          } else {
            console.warn("⚠️ Peer not ready for return signal, retrying...");
            setTimeout(() => {
              if (peerRef.current) {
                try {
                  peerRef.current.signal(signal);
                } catch (err) {
                  console.error("❌ Delayed signal failed:", err);
                }
              }
            }, 500);
          }
        });

        // ✅ USER DISCONNECTED
        socket.on("user-disconnected", () => {
          console.log("🚫 User disconnected");

          if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
          }

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }

          setMatched(false);
          setRemoteUserId(null);
        });
      })
      .catch((err) => {
        console.error("❌ Error accessing user media:", err);
      });

    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  console.log(streamReady)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white space-y-4">
      <h1 className="text-2xl font-bold">
        {matched
          ? `🎉 Connected!${remoteUserId ? ` (User: ${remoteUserId})` : ""}`
          : "🔍 Finding a Match..."}
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
