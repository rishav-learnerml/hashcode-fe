import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const socket = io("https://hashtalk.swagcoder.in", {
  transports: ["websocket"],
});

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const [matched, setMatched] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [remoteId, setRemoteId] = useState<string | null>(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log(myId)
      setMyId((socket as any).id);
      socket.emit("join-room", { roomId: "default" });
    });

    const initPeer = async () => {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localStream.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStream.current!);
      });

      peer.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate && remoteId) {
          socket.emit("sending-signal", {
            userToSignal: remoteId,
            signal: event.candidate,
          });
        }
      };

      peerRef.current = peer;
    };

    initPeer();

    // match found
    socket.on("match-found", async ({ socketId }) => {
      setRemoteId(socketId);
      const peer = peerRef.current!;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("sending-signal", {
        userToSignal: socketId,
        signal: offer,
      });
    });

    // handle offer
    socket.on("user-joined", async ({ signal, callerId }) => {
      setRemoteId(callerId);
      const peer = peerRef.current!;
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("returning-signal", {
        callerId,
        signal: answer,
      });
    });

    // handle answer
    socket.on("receiving-returned-signal", async ({ signal }) => {
      const peer = peerRef.current!;
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      setMatched(true);
      toast.success("🎉 You're now matched!");
    });

    // handle ICE
    socket.on("sending-signal", async ({ signal }) => {
      const peer = peerRef.current!;
      if (signal) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(signal));
        } catch (e) {
          console.error("ICE error", e);
        }
      }
    });

    socket.on("user-disconnected", () => {
      toast.info("User disconnected. Looking for a new match...");
      setMatched(false);
      window.location.reload(); // easy reset
    });

    return () => {
      socket.disconnect();
      peerRef.current?.close();
    };
  }, [remoteId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-950 text-white">
      <h1 className="text-2xl font-bold">
        {matched ? "You're connected 🔗" : "Waiting for a match... ⏳"}
      </h1>
      <div className="flex gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
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
