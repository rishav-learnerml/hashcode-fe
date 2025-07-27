import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://your-backend-url.com"); // Replace with your backend

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      localStreamRef.current = stream;
    };

    init();
  }, []);

  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Add local stream tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current as MediaStream);
    });

    // Send ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle remote stream
    const remoteStream = new MediaStream();
    peer.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    return peer;
  };

  const createOffer = async (targetId: string) => {
    peerRef.current = createPeerConnection();

    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);

    socket.emit("sending-signal", {
      userToSignal: targetId,
      signal: offer,
      callerId: socket.id,
    });
  };

  useEffect(() => {
    socket.on("match-found", ({ socketId }) => {
      console.log("Match found with", socketId);
      setRemoteSocketId(socketId);
      createOffer(socketId);
    });

    socket.on("user-joined", async ({ signal, callerId }) => {
      setRemoteSocketId(callerId);
      peerRef.current = createPeerConnection();
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("returning-signal", {
        signal: answer,
        callerId,
      });
    });

    socket.on("receiving-returned-signal", async ({ signal }) => {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(signal));
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding received ICE candidate", error);
      }
    });

    socket.on("user-disconnected", (id) => {
      console.log("User disconnected", id);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      peerRef.current?.close();
    });

    return () => {
      socket.off("match-found");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("ice-candidate");
      socket.off("user-disconnected");
    };
  }, [remoteSocketId]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">HashTalk Video Chat</h1>
      <div className="flex gap-4">
        <div>
          <p className="text-center">You</p>
          <video ref={localVideoRef} autoPlay playsInline muted className="rounded-md w-64 h-48 bg-black" />
        </div>
        <div>
          <p className="text-center">Stranger</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="rounded-md w-64 h-48 bg-black" />
        </div>
      </div>
    </div>
  );
};

export default Match;
