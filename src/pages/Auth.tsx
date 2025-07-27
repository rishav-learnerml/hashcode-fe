import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import logo from "/logo.png";
import { toast } from "sonner";

const API_URL = "https://hashtalk.swagcoder.in/auth"; // Your backend

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const user = localStorage.getItem("devmatch-user");

  useEffect(() => {
    if (user) navigate("/match");
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      return toast.error("Email and Password are required");
    }

    try {
      const res = await fetch(`${API_URL}/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      localStorage.setItem("devmatch-user", email);
      if (data.token) {
        localStorage.setItem("devmatch-token", data.token);
      } else {
        localStorage.removeItem("devmatch-token");
      }

      toast.success(
        activeTab === "login" ? "Welcome back!" : "Account created 🎉"
      );
      navigate("/match");
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 relative">
      {/* Floating Logo */}
      <div className="absolute top-6 flex justify-center w-full">
        <motion.img
          src={logo}
          alt="DevMatch Logo"
          className="w-20 h-20 md:w-40 md:h-40 z-10 cursor-pointer"
          animate={{ y: [0, -15, 0, -15, 0, -15, 0] }}
          transition={{ duration: 3, ease: "easeInOut" }}
          onClick={() => navigate("/")}
        />
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md mt-32 p-6 rounded-2xl shadow-2xl bg-zinc-900 border border-zinc-800 space-y-6">
        <h2 className="text-3xl font-extrabold text-center">
          Join HashTalk 🧠
        </h2>
        <p className="text-center text-gray-400 text-sm">
          {activeTab === "login"
            ? "Welcome back, developer!"
            : "Create your dev identity and vibe in!"}
        </p>

        <Tabs defaultValue="login" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800 rounded-lg mb-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Signup</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Your Email"
                className="bg-zinc-800 text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Your Password"
                className="bg-zinc-800 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 transition text-white"
                onClick={handleAuth}
              >
                Login
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="signup">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Email Address"
                className="bg-zinc-800 text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Create a Password"
                className="bg-zinc-800 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 transition text-white"
                onClick={handleAuth}
              >
                Signup
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-gray-500 text-sm z-10">
        Fully Free. Fully open source. Built for devs 🚀
      </div>
    </div>
  );
}
