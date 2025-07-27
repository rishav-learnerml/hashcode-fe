import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { motion } from "framer-motion";
import logo from "../assets/logo.png"; // or wherever your logo is stored
import Fireflies from "../components/Fireflies";

const socket = io("https://hashtalk.swagcoder.in", {
  transports: ["websocket"],
});

const Match = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [remoteSocketId, setRemoteSocketId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState<boolean>(false);
  const [icebreaker, setIcebreaker] = useState<string>("");

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
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "b10557008dab16b3b63274c4",
          credential: "ISOBNxTOrdXdqggD",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "b10557008dab16b3b63274c4",
          credential: "ISOBNxTOrdXdqggD",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "b10557008dab16b3b63274c4",
          credential: "ISOBNxTOrdXdqggD",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "b10557008dab16b3b63274c4",
          credential: "ISOBNxTOrdXdqggD",
        },
      ],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current!);
    });

    // Define once and reuse
    if (!remoteVideoRef.current) return peer;

    peer.ontrack = (event) => {
      console.log("✅ Remote track received", event.track.kind);

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }

      // Add only if track not already added
      const existingTracks = remoteStreamRef.current
        .getTracks()
        .map((t) => t.id);
      if (!existingTracks.includes(event.track.id)) {
        remoteStreamRef.current.addTrack(event.track);
      }

      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;

        remoteVideoRef.current
          .play()
          .then(() => console.log("▶️ Remote video playing"))
          .catch((err) => console.warn("❌ Remote video play error:", err));
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state changed to", peer.iceConnectionState);
      if (peer.iceConnectionState === "disconnected") {
        console.warn("Remote peer disconnected.");
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

    peer.getStats().then((stats) => {
      stats.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          report.state === "succeeded" &&
          report.nominated
        ) {
          console.log(
            "✅ Connection type:",
            report.localCandidateId,
            report.remoteCandidateId
          );
        }
      });
    });

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
      const state = peerRef.current?.signalingState;
      if (state !== "stable") {
        try {
          await peerRef.current?.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
        } catch (e) {
          console.error("Error setting returned signal:", e);
        }
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
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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

  useEffect(() => {
    if (remoteSocketId && isInitiator) {
      initiateCall();
    }
  }, [remoteSocketId, isInitiator]);

  // Icebreaker fetch
  useEffect(() => {
    const fetchIcebreaker = async () => {
      try {
        const res = await axios.get("http://localhost:3000/ai/icebreaker");
        setIcebreaker(res.data?.message || "Let's talk!");
      } catch (err) {
        console.error("Failed to fetch icebreaker:", err);
        setIcebreaker("Let's talk!");
      }
    };
    fetchIcebreaker();
  }, []);

  const handleRematch = async () => {
    window.location.reload(); // Simple rematch by reloading
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (remoteVideoRef.current) {
        console.log("🔍 remoteVideoRef", {
          srcObject: remoteVideoRef.current.srcObject,
          readyState: remoteVideoRef.current.readyState,
          paused: remoteVideoRef.current.paused,
          videoWidth: remoteVideoRef.current.videoWidth,
          videoHeight: remoteVideoRef.current.videoHeight,
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white flex flex-col items-center justify-center px-4 overflow-hidden">
      <Fireflies />

      {/* Animated Logo */}
      <motion.img
        src={logo}
        alt="HashTalk Logo"
        className="w-24 h-24 bg-transparent mb-8 z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
      />

      {/* Video Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-5xl z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        {/* Local Video */}
        <div className="flex flex-col items-center space-y-1">
          <p className="text-sm text-blue-300 tracking-wide">👤 You</p>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="rounded-xl border border-white/20 bg-black w-full max-w-sm aspect-video object-cover shadow-[0_0_20px_rgba(0,255,255,0.2)] md:w-96 md:h-96"
          />
        </div>

        {/* Remote Video */}
        <div className="flex flex-col items-center space-y-1">
          <p className="text-sm text-pink-300 tracking-wide">🧑‍💻 Stranger Dev</p>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="rounded-xl border border-white/20 bg-black w-full max-w-sm aspect-video object-cover shadow-[0_0_20px_rgba(255,0,255,0.2)] md:w-96 md:h-96"
          />
        </div>
      </motion.div>

      {/* Icebreaker Prompt */}
      <motion.div
        className="mt-8 bg-white/10 backdrop-blur-lg p-4 px-6 rounded-lg border border-white/10 text-center max-w-2xl w-full shadow-md z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p className="text-base font-medium text-white">
          💬 Icebreaker:{" "}
          <span className="italic text-blue-200">
            {icebreaker || "Loading..."}
          </span>
        </p>
      </motion.div>

      {/* Rematch Button */}
      <motion.button
        onClick={handleRematch}
        className="mt-6 px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold rounded-full shadow-lg transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🔁 Rematch
      </motion.button>

      {/* Footer */}
      <div className="absolute bottom-4 text-gray-400 text-xs z-10 tracking-wide">
        Made with 💙 for devs by{" "}
        <span className="text-white font-medium">Rishav</span> · Zero-Cost Infra
        · Full OSS 🚀
      </div>
    </div>
  );
};

export default Match;
