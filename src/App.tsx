import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Match from "./pages/Match"; // Create this later
import { Toaster } from "sonner";

function Router() {
  return (
    <>
    <Toaster richColors />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/match" element={<Match />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default Router;
