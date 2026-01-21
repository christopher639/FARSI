import { Radio, MessageSquare, Phone, Send, Users, Signal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const channels = [
  { id: 1, name: "Alpha Command", type: "secure", members: 12, active: true },
  { id: 2, name: "Border Ops", type: "secure", members: 8, active: true },
  { id: 3, name: "Intel Exchange", type: "encrypted", members: 5, active: false },
  { id: 4, name: "Field Units", type: "radio", members: 24, active: true },
];

const messages = [
  { id: 1, sender: "CMD-Alpha", time: "14:32", message: "All units, maintain positions. Surveillance ongoing.", type: "command" },
  { id: 2, sender: "Unit-7", time: "14:30", message: "Confirmed visual on target vehicle. Proceeding with tracking.", type: "field" },
  { id: 3, sender: "Intel-Desk", time: "14:28", message: "Updated threat assessment uploaded. Priority review required.", type: "intel" },
  { id: 4, sender: "Unit-12", time: "14:25", message: "Checkpoint Alpha secure. No suspicious activity.", type: "field" },
  { id: 5, sender: "CMD-Alpha", time: "14:20", message: "Initiating Operation Safeguard. All units acknowledge.", type: "command" },
];

const messageTypeColors = {
  command: "border-l-destructive",
  field: "border-l-success",
  intel: "border-l-warning",
};

export default function CommunicationsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Channels Sidebar */}
      <div className="w-72 bg-card border border-panel-border rounded-lg flex flex-col">
        <div className="p-4 border-b border-panel-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Secure Channels
          </h2>
        </div>
        <ScrollArea className="flex-1 p-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              className={`w-full p-3 rounded-lg text-left mb-2 transition-colors ${
                channel.active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{channel.name}</span>
                {channel.active && (
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>{channel.type}</span>
                <Users className="w-3 h-3 ml-2" />
                <span>{channel.members}</span>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-card border border-panel-border rounded-lg flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-panel-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              Alpha Command
              <Badge className="bg-success/20 text-success border-success/30">
                <Signal className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">12 members • End-to-end encrypted</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Users className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`pl-4 border-l-2 ${messageTypeColors[msg.type as keyof typeof messageTypeColors]}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{msg.sender}</span>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm text-muted-foreground">{msg.message}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-panel-border">
          <div className="flex gap-2">
            <Input placeholder="Type secure message..." className="flex-1" />
            <Button>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
