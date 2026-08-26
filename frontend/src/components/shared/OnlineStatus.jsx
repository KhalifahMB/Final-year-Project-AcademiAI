import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Tracks browser connectivity. Renders a compact status pill (for headers)
 * and fires toasts when connectivity changes. Also exposes the `online`
 * boolean for callers that need to gate behaviour.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      toast.success("Back online");
    };
    const goOffline = () => {
      setOnline(false);
      toast.error("You are offline — showing cached content", {
        description: "Changes that need a connection will fail until you reconnect.",
      });
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

export default function OnlineStatus({ className }) {
  const online = useOnlineStatus();

  return (
    <span
      role="status"
      aria-label={online ? "Online" : "Offline"}
      title={online ? "Online" : "Offline — using cached content"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        online
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {online ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Online
        </>
      ) : (
        <>
          <CloudOff className="h-3 w-3" aria-hidden />
          Offline
        </>
      )}
    </span>
  );
}
