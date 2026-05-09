import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import AuthScreen from "./pages/AuthScreen";
import ChatApp from "./pages/ChatApp";

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg text-zinc-400">
        Loading…
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return (
    <SocketProvider>
      <ChatApp />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
