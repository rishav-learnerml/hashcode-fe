import { useEffect, useRef, useState } from "react";
import { useUsername } from "../context/UsernameContext";
import { Button } from "../components/ui/button";
import { User, Video, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { io } from "socket.io-client";
import { toast } from "sonner";

const socket = io("https://hashtalk.swagcoder.in");
let peer: RTCPeerConnection | null = null;

export default function Match() {
  const { username } = useUsername();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [icebreaker, setIcebreaker] = useState("");
  const [matched, setMatched] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const setupMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const createPeer = async () => {
    peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          roomId: "default",
          signal: event.candidate,
          userId: socket.id,
        });
      }
    };

    // Handle remote stream
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Add local tracks to peer
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer!.addTrack(track, localStream);
      });
    }
  };

  const initiateOffer = async () => {
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("signal", {
      roomId: "default",
      signal: offer,
      userId: socket.id,
    });
  };

  const handleSignal = async ({ signal, userId }: any) => {
    if (userId === socket.id || !peer) return;

    try {
      if (signal.type === "offer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", {
          roomId: "default",
          signal: answer,
          userId: socket.id,
        });

        setMatched(true); // ✅ Add this line so second user sees they're matched
        toast.success("🎉 You're now matched!");
      } else if (signal.type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        setMatched(true);
        toast.success("🎉 You're now matched!");
      } else if (signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (error) {
      console.error("Error handling signal", error);
    }
  };

  const joinRoom = async () => {
    const stream = await setupMedia();
    socket.emit("join-room", { roomId: "default", userId: socket.id });

    socket.on("user-joined", async (userId) => {
      if (userId !== socket.id) {
        setRemoteUserId(userId);
        setMatched(true); // ✅ set matched true for the second peer
        toast.success("🎉 You're now matched!");

        await createPeer();
        stream.getTracks().forEach((track) => {
          peer!.addTrack(track, stream);
        });
        await initiateOffer();
      }
    });

    socket.on("all-users", async (users: string[]) => {
      const otherUsers = users.filter((id) => id !== socket.id);
      if (otherUsers.length > 0) {
        setRemoteUserId(otherUsers[0]);
        await createPeer();
        stream.getTracks().forEach((track) => {
          peer!.addTrack(track, stream);
        });
        await initiateOffer();
      }
    });

    socket.on("signal", handleSignal);
  };

  useEffect(() => {
    fetch("https://hashtalk.swagcoder.in/ai/icebreaker")
      .then((res) => res.json())
      .then((data) => setIcebreaker(data.message || "Start with a smile! 😄"));

    joinRoom();

    return () => {
      peer?.close();
      peer = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const resetMatch = () => {
    setMatched(false);
    setRemoteUserId("");
    peer?.close();
    peer = null;
    socket.removeAllListeners();
    socket.connect(); // reconnect
    joinRoom();
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
        {/* Local Video */}
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
          />
          <div className="flex items-center justify-between p-4 bg-zinc-800">
            <div className="flex items-center gap-2 text-indigo-300">
              <User className="w-5 h-5" />
              <span className="font-semibold">You ({username})</span>
            </div>
            <Video className="text-green-400 animate-pulse" />
          </div>
        </motion.div>

        {/* Remote Video or Waiting */}
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
            />
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
            className="rounded-2xl shadow-lg overflow-hidden border border-zinc-700 bg-zinc-900 flex items-center justify-center"
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
