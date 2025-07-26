import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const generateFireflies = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 6 + 4,
    delay: Math.random() * 4,
  }));

const Fireflies = () => {
  const [fireflies, setFireflies] = useState(generateFireflies(30));

  useEffect(() => {
    const interval = setInterval(() => {
      setFireflies(generateFireflies(30));
    }, 30000); // reposition every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {fireflies.map((fly) => (
        <motion.div
          key={fly.id}
          className="absolute rounded-full bg-yellow-300 blur-[2px] opacity-70"
          style={{
            width: fly.size,
            height: fly.size,
            left: fly.x,
            top: fly.y,
          }}
          animate={{
            x: [0, Math.random() * 30 - 15, 0],
            y: [0, Math.random() * 30 - 15, 0],
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: fly.delay,
          }}
        />
      ))}
    </div>
  );
};

export default Fireflies;
