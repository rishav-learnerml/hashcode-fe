import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://hashtalk.swagcoder.in"); // your signaling server

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    const roomId = "default";

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit("join-room", { roomId });

      socket.on("match-found", async ({ socketId }: { socketId: string }) => {
        setRemoteUserId(socketId);
        setMatched(true);
        createPeer(true, socketId);
      });

      socket.on("user-joined", async ({ signal, callerId }) => {
        setRemoteUserId(callerId);
        setMatched(true);
        createPeer(false, callerId, signal);
      });

      socket.on("signal", async ({ signal }) => {
        if (!peerConnection.current) return;
        if (signal.type === "offer") {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit("returning-signal", { signal: answer, callerId: remoteUserId });
        } else if (signal.type === "answer") {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
        } else if (signal.candidate) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal));
          } catch (err) {
            console.error("Error adding ICE candidate", err);
          }
        }
      });

      socket.on("user-disconnected", () => {
        if (peerConnection.current) {
          peerConnection.current.close();
          peerConnection.current = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setMatched(false);
        setRemoteUserId(null);
      });
    };

    const createPeer = async (
      isInitiator: boolean,
      otherUserId: string,
      incomingSignal?: RTCSessionDescriptionInit
    ) => {
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, localStream.current!);
        });
      }

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("sending-signal", {
            userToSignal: otherUserId,
            signal: event.candidate,
          });
        }
      };

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      if (isInitiator) {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("sending-signal", {
          userToSignal: otherUserId,
          signal: offer,
        });
      } else if (incomingSignal) {
        await peerConnection.current.setRemoteDescription(incomingSignal);
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("returning-signal", {
          signal: answer,
          callerId: otherUserId,
        });
      }
    };

    start();

    return () => {
      socket.disconnect();
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

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
