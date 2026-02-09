import { useState } from "react";
import { useCommunications } from "@/hooks/useCommunications";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, apiPut } from "@/lib/api";
import { Radio, MessageSquare, Phone, Send, Users, Signal, Lock, Plus, Flag, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const messageSchema = z.object({
  channel_type: z.string().min(1, "Channel type is required"),
  sender: z.string().max(200).optional(),
  recipient: z.string().max(200).optional(),
  content_summary: z.string().min(1, "Message content is required").max(2000),
  priority: z.enum(["critical", "high", "medium", "low", "info"]),
});

const channels = [
  { id: 1, name: "Alpha Command", type: "secure", members: 12, active: true },
  { id: 2, name: "Border Ops", type: "secure", members: 8, active: true },
  { id: 3, name: "Intel Exchange", type: "encrypted", members: 5, active: false },
  { id: 4, name: "Field Units", type: "radio", members: 24, active: true },
];

const priorityColors = {
  critical: "border-l-destructive",
  high: "border-l-warning",
  medium: "border-l-primary",
  low: "border-l-muted",
  info: "border-l-success",
};

export default function CommunicationsPage() {
  const { communications, loading, refetch } = useCommunications();
  const { user, isAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const [formData, setFormData] = useState<{
    channel_type: string;
    sender: string;
    recipient: string;
    content_summary: string;
    priority: "critical" | "high" | "medium" | "low" | "info";
  }>({
    channel_type: "secure",
    sender: "",
    recipient: "",
    content_summary: "",
    priority: "medium",
  });

  const filteredCommunications = communications.filter(comm =>
    comm.content_summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comm.sender?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comm.recipient?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = messageSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      const isFlagged = formData.priority === "critical" || formData.priority === "high";
      await apiPost("/communications", {
        channel_type: formData.channel_type,
        sender: formData.sender || null,
        recipient: formData.recipient || null,
        content_summary: formData.content_summary,
        priority: formData.priority,
        flagged: isFlagged,
      });

      toast.success("Communication logged successfully");
      setIsCreateDialogOpen(false);
      setFormData({
        channel_type: "secure",
        sender: "",
        recipient: "",
        content_summary: "",
        priority: "medium",
      });
      refetch();
    } catch (error: any) {
      console.error("Error creating communication:", error);
      toast.error(error.message || "Failed to log communication");
    } finally {
      setCreating(false);
    }
  };

  const handleQuickMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await apiPost("/communications", {
        channel_type: "secure",
        sender: user?.email?.split("@")[0] || "Unknown",
        content_summary: newMessage,
        priority: "medium",
      });

      setNewMessage("");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  const handleFlagMessage = async (id: string, currentFlagged: boolean) => {
    try {
      await apiPut(`/communications/${id}`, { flagged: !currentFlagged });
      toast.success(currentFlagged ? "Message unflagged" : "Message flagged");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update message");
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Channels Sidebar */}
      <div className="w-full md:w-72 bg-card border border-panel-border rounded-lg flex flex-col shrink-0">
        <div className="p-4 border-b border-panel-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Secure Channels
          </h2>
        </div>
        <ScrollArea className="flex-1 p-2 max-h-40 md:max-h-none">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
            {channels.map((channel) => (
              <button
                key={channel.id}
                className={`p-3 rounded-lg text-left transition-colors shrink-0 md:w-full min-w-[200px] md:min-w-0 ${
                  channel.active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
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
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-card border border-panel-border rounded-lg flex flex-col min-h-0">
        {/* Chat Header */}
        <div className="p-4 border-b border-panel-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
            {isAdmin && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Log Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                  <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Log Communication
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                    <form onSubmit={handleCreateMessage} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="channel_type">Channel Type *</Label>
                          <Select
                            value={formData.channel_type}
                            onValueChange={(value) => setFormData({ ...formData, channel_type: value })}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="secure">Secure</SelectItem>
                              <SelectItem value="encrypted">Encrypted</SelectItem>
                              <SelectItem value="radio">Radio</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priority">Priority *</Label>
                          <Select
                            value={formData.priority}
                            onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sender">Sender</Label>
                          <Input
                            id="sender"
                            value={formData.sender}
                            onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                            placeholder="CMD-Alpha"
                            className="bg-background/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="recipient">Recipient</Label>
                          <Input
                            id="recipient"
                            value={formData.recipient}
                            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                            placeholder="All Units"
                            className="bg-background/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="content_summary">Message Content *</Label>
                        <Textarea
                          id="content_summary"
                          value={formData.content_summary}
                          onChange={(e) => setFormData({ ...formData, content_summary: e.target.value })}
                          placeholder="Communication content..."
                          rows={4}
                          className="bg-background/50"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Logging...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Log Communication
                          </>
                        )}
                      </Button>
                    </form>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="outline" size="icon">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Users className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-panel-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredCommunications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No communications found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCommunications.map((msg) => (
                <div
                  key={msg.id}
                  className={`pl-4 border-l-2 ${priorityColors[msg.priority as keyof typeof priorityColors] || 'border-l-muted'} group`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{msg.sender || 'Unknown'}</span>
                      {msg.recipient && (
                        <span className="text-xs text-muted-foreground">→ {msg.recipient}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      </span>
                      {msg.flagged && (
                        <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                          <Flag className="w-2 h-2 mr-1" />
                          Flagged
                        </Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleFlagMessage(msg.id, msg.flagged || false)}
                      >
                        <Flag className={`w-3 h-3 ${msg.flagged ? 'text-warning fill-warning' : ''}`} />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.content_summary}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-panel-border">
          <div className="flex gap-2">
            <Input
              placeholder="Type secure message..."
              className="flex-1"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickMessage();
                }
              }}
            />
            <Button onClick={handleQuickMessage} disabled={!newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
