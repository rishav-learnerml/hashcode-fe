import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

// ⚠️ Replace with your deployed backend WebSocket URL
const socket = io("https://hashtalk.swagcoder.in", {
  transports: ["websocket"],
});

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);

  // 👀 Initialize local media
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

  // 🛠️ Create new peer connection
  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "turn:relay.metered.ca:80",
          username: "openai",
          credential: "openai",
        },
        {
          urls: "turn:relay.metered.ca:443",
          username: "openai",
          credential: "openai",
        },
        {
          urls: "turn:relay.metered.ca:443?transport=tcp",
          username: "openai",
          credential: "openai",
        },
      ],
    });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current as MediaStream);
    });

    // 🔁 Handle ICE candidate
    peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    // 🎥 Remote video stream
    const remoteStream = new MediaStream();
    peer.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    return peer;
  };

  // 📞 Initiate call (create offer)
  const initiateCall = async (targetId: string) => {
    peerRef.current = createPeerConnection();
    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);

    socket.emit("sending-signal", {
      userToSignal: targetId,
      signal: offer,
      callerId: socket.id,
    });
  };

  // 💬 Socket listeners
  useEffect(() => {
    socket.on("match-found", ({ socketId }) => {
      console.log("Match found with", socketId);
      setRemoteSocketId(socketId);
      initiateCall(socketId);
    });

    socket.on("user-joined", async ({ signal, callerId }) => {
      console.log("User joined:", callerId);
      setRemoteSocketId(callerId);
      peerRef.current = createPeerConnection();

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(signal)
      );

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("returning-signal", {
        signal: answer,
        callerId,
      });
    });

    socket.on("receiving-returned-signal", async ({ signal }) => {
      console.log("Receiving returned signal");
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(signal)
      );
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding received ice candidate", err);
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
  }, [remoteSocketId]);

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
