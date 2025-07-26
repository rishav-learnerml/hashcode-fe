import Fireflies from "../components/Fireflies";
import { Button } from "../components/ui/button";
import { motion } from "framer-motion";
import logo from "/logo.png"; // or wherever your logo is stored
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

function App() {
  const navigate = useNavigate();

  const user = localStorage.getItem("devmatch-user");

  useEffect(() => {
    if (user) navigate("/match");
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden px-4">
      <Fireflies />

      <motion.img
        src={logo}
        alt="DevMatch Logo"
        className="w-24 h-24 md:w-44 md:h-44 mb-6 z-10 -mt-20 cursor-pointer"
        animate={{
          y: [0, -20, 0, -20, 0, -20, 0], // 3 bounces: big, medium, small
        }}
        transition={{
          duration: 3,
          ease: "easeInOut",
        }}

      />

      {/* Hero content */}
      <div className="z-10 text-center max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Connect. Chat. <span className="text-purple-500">Anonymously.</span>
        </h1>
        <p className="mt-4 text-lg text-gray-300">
          Meet random developers, share ideas, and vibe out!
        </p>
        <Button
          className="mt-8 text-lg px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 transition text-white cursor-pointer"
          onClick={() => (user ? navigate("/match") : navigate("/auth"))}
        >
          Start Matching
        </Button>
      </div>

      {/* Footer hint */}
      <div className="absolute bottom-4 text-gray-500 text-sm z-10">
        Made with 🧠 for Devs by Rishav. Zero-Cost Infra. Full OSS.
      </div>
    </div>
  );
}

export default App;
