import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("https://hashtalk.swagcoder.in");

const Match = () => {
  const [matched, setMatched] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    try {
      const roomId = "default"; // better to keep this fixed
      console.log("Initializing media and socket for room:", roomId);

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((mediaStream) => {
          try {
            streamRef.current = mediaStream;
            setStreamReady(true);
            console.log("Local media stream obtained", mediaStream);

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = mediaStream;
              console.log("Local video element set");
            }

            socket.emit("join-room", { roomId });
            console.log("Emitted join-room");

            socket.on("match-found", ({ socketId }) => {
              try {
                console.log("Matched with", socketId);
                setMatched(true);
                setRemoteUserId(socketId);

                const peer = new Peer({
                  initiator: true,
                  trickle: false,
                  stream: mediaStream,
                });
                console.log("Peer created as initiator");

                peer.on("signal", (signal) => {
                  try {
                    console.log("Peer signal (initiator)", signal);
                    socket.emit("sending-signal", {
                      userToSignal: socketId,
                      signal,
                    });
                    console.log("Emitted sending-signal");
                  } catch (err) {
                    console.error(
                      "Error in peer.on('signal') (initiator)",
                      err
                    );
                  }
                });

                peer.on("stream", (remoteStream) => {
                  try {
                    console.log(
                      "📹 Remote stream received (initiator)",
                      remoteStream
                    );
                    if (remoteVideoRef.current) {
                      remoteVideoRef.current.srcObject = remoteStream;
                      console.log("Remote video element set (initiator)");
                    }
                  } catch (err) {
                    console.error(
                      "Error in peer.on('stream') (initiator)",
                      err
                    );
                  }
                });

                peerRef.current = peer;
              } catch (err) {
                console.error("Error in match-found handler", err);
              }
            });

            socket.on("user-joined", ({ signal, callerId }) => {
              try {
                console.log("📞 Received signal from", callerId);
                setRemoteUserId(callerId);

                const peer = new Peer({
                  initiator: false,
                  trickle: false,
                  stream: mediaStream,
                });
                console.log("Peer created as callee");

                peer.on("signal", (signal) => {
                  try {
                    console.log("Peer signal (callee)", signal);
                    socket.emit("returning-signal", {
                      signal,
                      callerId,
                    });
                    console.log("Emitted returning-signal");
                  } catch (err) {
                    console.error("Error in peer.on('signal') (callee)", err);
                  }
                });

                peer.on("stream", (remoteStream) => {
                  try {
                    console.log(
                      "📹 Remote stream received (callee)",
                      remoteStream
                    );
                    if (remoteVideoRef.current) {
                      remoteVideoRef.current.srcObject = remoteStream;
                      console.log("Remote video element set (callee)");
                    }
                  } catch (err) {
                    console.error("Error in peer.on('stream') (callee)", err);
                  }
                });

                try {
                  peer.signal(signal);
                  console.log("Peer signaled with caller's signal");
                } catch (err) {
                  console.error("Error signaling peer (callee)", err);
                }
                peerRef.current = peer;
              } catch (err) {
                console.error("Error in user-joined handler", err);
              }
            });

            socket.on("receiving-returned-signal", ({ signal, id }) => {
              try {
                console.log("🎯 Receiving returned signal from", id);
                if (peerRef.current) {
                  peerRef.current.signal(signal);
                  console.log("Peer signaled with returned signal");
                } else {
                  console.warn(
                    "⚠️ peerRef not ready. Delaying signal application."
                  );
                  setTimeout(() => {
                    try {
                      if (peerRef.current) {
                        peerRef.current.signal(signal);
                        console.log("Peer signaled after delay");
                      } else {
                        console.error(
                          "❌ Still no peerRef. Cannot apply signal."
                        );
                      }
                    } catch (err) {
                      console.error("Error in delayed signal application", err);
                    }
                  }, 500); // adjust if needed
                }
              } catch (err) {
                console.error(
                  "Error in receiving-returned-signal handler",
                  err
                );
              }
            });

            socket.on("user-disconnected", () => {
              try {
                console.log("❌ User disconnected");
                if (peerRef.current) {
                  peerRef.current.destroy();
                  console.log("Peer destroyed on disconnect");
                }
                peerRef.current = null;
                setMatched(false);
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = null;
                  console.log("Remote video element cleared on disconnect");
                }
              } catch (err) {
                console.error("Error in user-disconnected handler", err);
              }
            });
          } catch (err) {
            console.error("Error in mediaStream then block", err);
          }
        })
        .catch((err) => {
          console.error("Error getting user media", err);
        });
    } catch (err) {
      console.error("Error in useEffect setup", err);
    }

    return () => {
      try {
        socket.disconnect();
        console.log("Socket disconnected in cleanup");
        if (peerRef.current) {
          peerRef.current.destroy();
          console.log("Peer destroyed in cleanup");
        }
      } catch (err) {
        console.error("Error in cleanup", err);
      }
    };
  }, []);

  console.log(streamReady, "streamReady");
  console.log(remoteVideoRef, "remoteVideoRef");
  console.log(localVideoRef, "localVideoRef");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white space-y-4">
      <h1 className="text-2xl font-bold">
        {matched
          ? `🎉 Connected!${remoteUserId ? ` (User: ${remoteUserId})` : "error!"}`
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
        <div className="text-xl"></div>
      </div>
    </div>
  );
};

export default Match;
