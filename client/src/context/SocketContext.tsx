import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

type SocketCtx = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketCtx>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket((s) => {
        s?.disconnect();
        return null;
      });
      setConnected(false);
      return;
    }
    const s = io({
      auth: { token },
      transports: ["websocket", "polling"],
    });
    setSocket(s);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
      setConnected(false);
    };
  }, [token]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
