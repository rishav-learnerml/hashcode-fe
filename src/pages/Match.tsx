import  { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://hashtalk.swagcoder.in"); // replace with your deployed backend

const Match = () => {
  const [isMatched, setIsMatched] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const otherUser = useRef<string | null>(null);

  useEffect(() => {
    // Connect to socket
    socket.emit("join-room", { roomId: "default" });

    // Get local stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        localStreamRef.current = stream;

        // When matched, we start the peer connection
        socket.on("matched", ({ otherSocketId }) => {
          otherUser.current = otherSocketId;
          setIsMatched(true);
          console.log(isMatched);
          const peer = createPeer(otherSocketId);
          peerRef.current = peer;

          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        });
      });

    // When receiving signal
    socket.on("signal", ({ from, signal }) => {
      let peer:any = peerRef.current;
      if (!peer) {
        peer = addPeer(signal, from);
        peerRef.current = peer;
      } else {
        peer.signal(signal);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function createPeer(userToSignal: string) {
    const peer = new (window as any).SimplePeer({
      initiator: true,
      trickle: false,
      stream: localStreamRef.current,
    });

    peer.on("signal", (signal:any) => {
      socket.emit("sending-signal", { signal, to: userToSignal });
    });

    peer.on("stream", (stream:any) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    });

    return peer;
  }

  function addPeer(incomingSignal: any, callerId: string) {
    const peer = new (window as any).SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStreamRef.current,
    });

    peer.on("signal", (signal:any) => {
      socket.emit("returning-signal", { signal, to: callerId });
    });

    peer.on("stream", (stream:any) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    });

    peer.signal(incomingSignal);
    return peer;
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">You</h2>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="rounded shadow-lg"
        />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Stranger</h2>
        <video ref={remoteVideoRef} autoPlay className="rounded shadow-lg" />
      </div>
    </div>
  );
};

export default Match;
