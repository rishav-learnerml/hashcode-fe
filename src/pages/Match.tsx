import { useEffect, useRef, useState } from "react";
import { useUsername } from "../context/UsernameContext";
import { Button } from "../components/ui/button";
import { User, Video, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { io } from "socket.io-client";
import { toast } from "sonner";

const socket = io("https://hashtalk.swagcoder.in/");
let peer: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

export default function Match() {
  const { username } = useUsername();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [icebreaker, setIcebreaker] = useState("");
  const [matched, setMatched] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState("");

  const setupPeerConnection = async () => {
    peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // If stream already exists, reuse it; else get new one
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    }

    // Set local video stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    // Add tracks to peer
    localStream.getTracks().forEach((track) => {
      peer!.addTrack(track, localStream!);
    });

    peer.onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit("signal", {
          roomId: "default",
          signal: event.candidate,
          userId: socket.id,
        });
      }
    };

    peer.ontrack = (event: any) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  const initiateConnection = async (isInitiator: boolean) => {
    if (isInitiator && peer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("signal", {
        roomId: "default",
        signal: offer,
        userId: socket.id,
      });
    }
  };

  const setup = async () => {
    if (peer) peer.close();
    peer = null;
    await setupPeerConnection();

    fetch("https://hashtalk.swagcoder.in/ai/icebreaker")
      .then((res) => res.json())
      .then((data) => setIcebreaker(data.message || "Start with a smile! 😄"));

    socket.emit("join-room", { roomId: "default", userId: socket.id });

    socket.on("user-joined", async (userId) => {
      if (userId !== socket.id) {
        setRemoteUserId(userId);
        await initiateConnection(true);
      }
    });

    socket.on("signal", async ({ signal, userId }) => {
      if (userId === socket.id || !peer) return;

      if (signal.type === "offer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", {
          roomId: "default",
          signal: answer,
          userId: socket.id,
        });
      } else if (signal.type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        setMatched(true);
        toast.success("🎉 You're now matched!");
      } else if (signal.candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(signal));
        } catch (err) {
          console.error("Error adding ICE candidate", err);
        }
      }
    });

    socket.on("all-users", async (userIds: string[]) => {
      for (const userId of userIds) {
        if (userId !== socket.id) {
          setRemoteUserId(userId);
          await initiateConnection(true);
        }
      }
    });
  };

  useEffect(() => {
    setup();
    return () => {
      peer?.close();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const resetMatch = () => {
    setMatched(false);
    setRemoteUserId("");
    peer?.close();
    peer = null;
    socket.removeAllListeners(); // prevent multiple event listeners
    setup();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white py-10 px-6 flex flex-col gap-10 items-center justify-center">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl md:text-5xl font-bold text-center text-white tracking-tight"
      >
        🔥 Matching as <span className="text-indigo-400">{username}</span>...
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-lg text-zinc-300 text-center max-w-xl"
      >
        🤖 Icebreaker:{" "}
        <span className="italic text-teal-300">{icebreaker}</span>
      </motion.p>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="relative rounded-2xl shadow-lg overflow-hidden border border-zinc-700 bg-zinc-900"
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-80 object-cover rounded-t-2xl"
          ></video>
          <div className="flex items-center justify-between p-4 bg-zinc-800">
            <div className="flex items-center gap-2 text-indigo-300">
              <User className="w-5 h-5" />
              <span className="font-semibold">You ({username})</span>
            </div>
            <Video className="text-green-400 animate-pulse" />
          </div>
        </motion.div>

        {matched ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="relative rounded-2xl shadow-lg overflow-hidden border border-zinc-700 bg-zinc-900"
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              className="w-full h-80 object-cover rounded-t-2xl"
            ></video>
            <div className="flex items-center justify-between p-4 bg-zinc-800">
              <div className="flex items-center gap-2 text-pink-300">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">Stranger : {remoteUserId}</span>
              </div>
              <Video className="text-red-400 animate-pulse" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="relative rounded-2xl shadow-lg overflow-hidden border border-zinc-700 bg-zinc-900 flex items-center justify-center"
            style={{ minHeight: "22rem" }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center p-8">
              <Bot className="w-10 h-10 text-pink-300 mb-4 animate-bounce" />
              <span className="font-semibold text-lg text-zinc-300">
                Waiting for a match...
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <Button
          variant="outline"
          onClick={resetMatch}
          className="text-lg px-6 py-2 rounded-xl border-indigo-500 text-indigo-300 hover:bg-indigo-500 hover:text-white"
        >
          🔄 Find Another Match
        </Button>
      </motion.div>
    </div>
  );
}
