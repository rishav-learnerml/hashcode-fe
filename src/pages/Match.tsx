import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_SERVER_URL = "https://hashtalk.swagcoder.in"; // your deployed backend

const Match: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [matched, setMatched] = useState(false);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);
    const socket = socketRef.current;

    let localStream: MediaStream;

    const init = async () => {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      peerRef.current = new RTCPeerConnection(configuration);

      // Add tracks to peer connection
      localStream.getTracks().forEach((track) => {
        peerRef.current!.addTrack(track, localStream);
      });

      // Handle remote stream
      peerRef.current.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        console.log("🎥 Remote stream set");
      };

      // Handle ICE candidates
      peerRef.current.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", event.candidate);
        }
      };

      // Join room
      socket.emit("join-room");

      // Handle match
      socket.on("user-joined", async (userId: string) => {
        console.log("👋 Matched with another user");

        const offer = await peerRef.current!.createOffer();
        await peerRef.current!.setLocalDescription(offer);

        socket.emit("sending-signal", {
          signal: offer,
          to: userId,
        });
      });

      socket.on("receive-signal", async ({ signal, from }) => {
        await peerRef.current!.setRemoteDescription(new RTCSessionDescription(signal));

        const answer = await peerRef.current!.createAnswer();
        await peerRef.current!.setLocalDescription(answer);

        socket.emit("returning-signal", {
          signal: answer,
          to: from,
        });
      });

      socket.on("received-returned-signal", async ({ signal }) => {
        await peerRef.current!.setRemoteDescription(new RTCSessionDescription(signal));
        console.log("✅ Connected with peer");
        setMatched(true);
      });

      socket.on("ice-candidate", async (candidate) => {
        try {
          await peerRef.current!.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate", err);
        }
      });
    };

    init();

    return () => {
      socket.disconnect();
      peerRef.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-semibold mb-2">
        {matched ? "You're connected 🔗" : "Looking for someone... 🔍"}
      </h1>
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <p className="mb-1 text-sm">You</p>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-64 h-48 bg-black rounded-xl" />
        </div>
        <div className="flex flex-col items-center">
          <p className="mb-1 text-sm">Stranger</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default Match;
