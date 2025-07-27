import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://hashtalk.swagcoder.in", {
  transports: ["websocket"],
});

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState<boolean>(false);

  // 1. Get local media
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get local media:", err);
      }
    };
    getMedia();
  }, []);

  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay.metered.ca:443",
          username: "openai",
          credential: "openai",
        },
      ],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current!);
    });

    const remoteStream = new MediaStream();
    peer.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    return peer;
  };

  const initiateCall = async () => {
    try {
      const peer = createPeerConnection();
      peerRef.current = peer;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("sending-signal", {
        userToSignal: remoteSocketId,
        signal: offer,
        callerId: socket.id,
      });
    } catch (err) {
      console.error("Error initiating call:", err);
    }
  };

  useEffect(() => {
    socket.on("match-found", ({ socketId }: { socketId: string }) => {
      console.log("Match found with", socketId);
      setRemoteSocketId(socketId);

      // Simple deterministic logic: lexicographically smaller ID initiates
      if ((socket as any).id < socketId) {
        setIsInitiator(true);
      }
    });

    socket.on("user-joined", async ({ signal, callerId }) => {
      console.log("User joined:", callerId);
      setRemoteSocketId(callerId);
      const peer = createPeerConnection();
      peerRef.current = peer;

      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("returning-signal", {
        signal: answer,
        callerId,
      });
    });

    socket.on("receiving-returned-signal", async ({ signal }) => {
      console.log("Receiving returned signal");
      const connectionState = peerRef.current?.signalingState;
      if (connectionState !== "stable") {
        try {
          await peerRef.current?.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
        } catch (e) {
          console.error("Error setting returned signal:", e);
        }
      } else {
        console.log("Ignoring returned signal due to state:", connectionState);
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    });

    socket.on("user-disconnected", (id) => {
      console.log("User disconnected:", id);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      peerRef.current?.close();
      peerRef.current = null;
    });

    return () => {
      socket.off("match-found");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("ice-candidate");
      socket.off("user-disconnected");
    };
  }, []);

  // Trigger call initiation after we know both socketId and role
  useEffect(() => {
    if (remoteSocketId && isInitiator) {
      initiateCall();
    }
  }, [remoteSocketId, isInitiator]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 gap-6">
      <h1 className="text-3xl font-bold">🔗 HashTalk Video Chat</h1>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex flex-col items-center">
          <p className="mb-2">👤 You</p>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-72 h-56 bg-black rounded-md shadow-lg"
          />
        </div>
        <div className="flex flex-col items-center">
          <p className="mb-2">🧑‍💻 Stranger</p>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-72 h-56 bg-black rounded-md shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default Match;
