import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

export function NotificationCenter({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // Fetch notifications on open or userId change
  useEffect(() => {
    if (!userId) return;
    // Use the Supabase client correctly for querying
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then((result) => {
        // Supabase returns { data, error }
        if (result.error) {
          console.error("Error fetching notifications:", result.error);
          setNotifications([]);
        } else {
          setNotifications(result.data || []);
        }
      });
  }, [userId, open]);

  // Subscribe to new notifications in real-time
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative">
        <Bell className="w-6 h-6" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2 font-bold border-b">Notifications</div>
          {notifications.length === 0 && (
            <div className="p-4 text-center text-gray-400">No notifications</div>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={`p-3 border-b ${n.read ? "bg-gray-50" : "bg-blue-50"}`}>
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm">{n.body}</div>
              <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}