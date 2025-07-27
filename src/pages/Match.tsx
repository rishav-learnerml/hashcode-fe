import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://hashtalk.swagcoder.in"); // your deployed backend

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.error);
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate && roomId) {
          socket.emit("ice-candidate", { candidate: event.candidate, roomId });
        }
      };

      let remoteStreamSet = false;

      peer.ontrack = ({ streams }) => {
        if (remoteStreamSet || !streams[0]) return;

        const remoteStream = streams[0];
        const remoteVideo = remoteVideoRef.current;

        if (remoteVideo) {
          remoteVideo.srcObject = remoteStream;

          remoteVideo.onloadedmetadata = () => {
            remoteVideo
              .play()
              .then(() => console.log("✅ Remote video playing"))
              .catch((e) => console.error("❌ Video play error", e));
          };
        }

        remoteStreamSet = true;
      };

      socket.on("match-found", async ({ roomId, isInitiator }) => {
        setRoomId(roomId);

        if (isInitiator) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit("offer", { offer, roomId });
        }
      });

      socket.on("offer", async ({ offer }) => {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { answer, roomId });
      });

      socket.on("answer", async ({ answer }) => {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("ice-candidate", async ({ candidate }) => {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding received ICE candidate", err);
        }
      });

      socket.emit("join-room");
    };

    start();

    return () => {
      socket.disconnect();
      peerRef.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white space-y-4 p-4">
      <h1 className="text-3xl font-bold">🎥 HashTalk: Anonymous Video Match</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-4xl">
        <div className="relative w-full h-64 bg-gray-800 rounded overflow-hidden">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
          <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            You
          </span>
        </div>
        <div className="relative w-full h-64 bg-gray-800 rounded overflow-hidden">
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
          <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            Stranger
          </span>
        </div>
      </div>
    </div>
  );
};

export default Match;
