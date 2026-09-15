"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/lib/api";

export function RealtimeStatus({ showIds = [], customerId = "demo-user" }: { showIds?: string[]; customerId?: string }) {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.emit("join", `customer_${customerId}`);
    showIds.forEach((id) => socket.emit("join", `show_${id}`));
    socket.on("show:ticket_sold", (payload) => setEvents((items) => [`Đã bán ${payload.quantity} vé`, ...items].slice(0, 4)));
    socket.on("ticket:verified", (payload) => setEvents((items) => [`Đã verify ${payload.gate_id || payload.type}`, ...items].slice(0, 4)));
    return () => {
      socket.disconnect();
    };
  }, [customerId, showIds]);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <b>Realtime</b>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </div>
      <div className="mt-3 grid gap-2 text-sm text-zinc-600">
        {events.length ? events.map((item, index) => <span key={`${item}-${index}`}>{item}</span>) : <span>Đang nghe socket events...</span>}
      </div>
    </div>
  );
}
