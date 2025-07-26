import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const socket = io("https://hashtalk.swagcoder.in"); // 🟢 Update if needed

const Match = () => {
  const [matched, setMatched] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const peer = new RTCPeerConnection();
        localStream
          .getTracks()
          .forEach((track) => peer.addTrack(track, localStream));
        peerRef.current = peer;

        peer.ontrack = (event) => {
          const [stream] = event.streams;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("signal", {
              roomId: "default",
              signal: event.candidate,
              userId: socket.id,
            });
          }
        };

        socket.emit("join-room", "default");

        socket.on("signal", async ({ signal }) => {
          const peer = peerRef.current;
          if (!peer) return;

          if (signal.type === "offer") {
            console.log("📶 Received Offer");
            await peer.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit("signal", {
              roomId: "default",
              signal: answer,
              userId: socket.id,
            });

            setMatched(true);
            toast.success("🎉 Matched (receiver side)");
          } else if (signal.type === "answer") {
            console.log("📶 Received Answer");
            await peer.setRemoteDescription(new RTCSessionDescription(signal));
            setMatched(true);
            toast.success("🎉 Matched (offerer side)");
          } else if (signal.candidate) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(signal));
            } catch (err) {
              console.error("Failed to add ICE candidate", err);
            }
          }
        });

        socket.on("users-in-room", async (users: string[]) => {
          if (users.length === 2) {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);

            socket.emit("signal", {
              roomId: "default",
              signal: offer,
              userId: socket.id,
            });
          }
        });

        socket.on("user-disconnected", () => {
          toast.warning("⚠️ User disconnected");
          setMatched(false);
        });
      } catch (err) {
        console.error("Media access error:", err);
        toast.error("Failed to access webcam/microphone.");
      }
    };

    init();

    return () => {
      peerRef.current?.close();
      socket.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="rounded-xl w-80 shadow-lg"
      />
      {matched ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="rounded-xl w-80 shadow-lg"
        />
      ) : (
        <div className="text-lg text-gray-500">⌛ Waiting for a match...</div>
      )}
    </div>
  );
};

export default Match;
