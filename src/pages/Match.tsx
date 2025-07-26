import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const socket = io("https://hashtalk.swagcoder.in", {
  transports: ["websocket"],
});

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [matched, setMatched] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      });

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate && remoteUserId) {
          socket.emit("sending-signal", {
            userToSignal: remoteUserId,
            signal: event.candidate,
          });
        }
      };

      peerRef.current = peer;

      socket.emit("join-room", { roomId: "default" });

      socket.on("user-joined", async ({ signal, callerId }) => {
        setRemoteUserId(callerId);
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("returning-signal", {
          callerId,
          signal: answer,
        });
      });

      socket.on("receiving-returned-signal", async ({ signal }) => {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        setMatched(true);
        toast.success("🎉 You're now matched!");
      });

      socket.on("sending-signal", async ({ signal, userToSignal }) => {
        await peer.addIceCandidate(new RTCIceCandidate(signal));
      });

      socket.on("user-disconnected", () => {
        setMatched(false);
        toast.info("User disconnected. Searching again...");
        if (peerRef.current) {
          peerRef.current.close();
        }
        init(); // Re-initialize
      });
    };

    init();

    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-950 text-white">
      <h1 className="text-2xl font-bold">
        {matched ? "You're connected 🔗" : "Waiting for a match... ⏳"}
      </h1>
      <div className="flex gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-64 bg-black rounded-xl"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-64 h-64 bg-black rounded-xl"
        />
      </div>
    </div>
  );
};

export default Match;
