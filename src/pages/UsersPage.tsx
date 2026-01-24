import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserPlus, Shield, Search, Users, Mail, Send, Loader2, Edit, Trash2 } from 'lucide-react';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email' }).max(255),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(128),
  fullName: z.string().trim().min(2, { message: 'Name is required' }).max(100),
  username: z.string().trim().min(3, { message: 'Username must be at least 3 characters' }).max(50).optional(),
  department: z.string().max(100).optional(),
  badgeNumber: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  clearanceLevel: z.enum(['top_secret', 'secret', 'confidential', 'unclassified']),
  role: z.enum(['admin', 'analyst', 'viewer']),
});

const inviteUserSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email' }).max(255),
  role: z.enum(['admin', 'analyst', 'viewer']),
  clearanceLevel: z.enum(['top_secret', 'secret', 'confidential', 'unclassified']),
  department: z.string().max(100).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2, { message: 'Name is required' }).max(100),
  department: z.string().max(100).optional(),
  badgeNumber: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  clearanceLevel: z.enum(['top_secret', 'secret', 'confidential', 'unclassified']),
  role: z.enum(['admin', 'analyst', 'viewer']),
  status: z.enum(['active', 'inactive', 'suspended']),
});

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  email: string;
  department: string | null;
  clearance_level: string;
  badge_number: string | null;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  created_at: string;
};

type UserRole = {
  user_id: string;
  role: string;
};

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  // Form state for creating user
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    username: '',
    department: '',
    badgeNumber: '',
    phone: '',
    clearanceLevel: 'unclassified' as const,
    role: 'viewer' as const,
  });

  // Form state for inviting user
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'viewer' as const,
    clearanceLevel: 'unclassified' as const,
    department: '',
  });

  // Form state for editing user
  const [editData, setEditData] = useState({
    fullName: '',
    department: '',
    badgeNumber: '',
    phone: '',
    clearanceLevel: 'unclassified' as const,
    role: 'viewer' as const,
    status: 'active' as const,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      setUsers(profiles || []);
      setUserRoles(roles || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      username: '',
      department: '',
      badgeNumber: '',
      phone: '',
      clearanceLevel: 'unclassified',
      role: 'viewer',
    });
    setInviteData({
      email: '',
      role: 'viewer',
      clearanceLevel: 'unclassified',
      department: '',
    });
    setActiveTab('create');
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    const userRole = getUserRole(user.user_id);
    setEditData({
      fullName: user.full_name,
      department: user.department || '',
      badgeNumber: user.badge_number || '',
      phone: user.phone || '',
      clearanceLevel: user.clearance_level as any,
      role: (userRole !== 'No Role' ? userRole : 'viewer') as any,
      status: user.status as any,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    const validation = updateUserSchema.safeParse(editData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setUpdating(true);
    try {
      const response = await supabase.functions.invoke('update-user', {
        body: {
          userId: selectedUser.user_id,
          fullName: editData.fullName,
          department: editData.department || null,
          badgeNumber: editData.badgeNumber || null,
          phone: editData.phone || null,
          clearanceLevel: editData.clearanceLevel,
          role: editData.role,
          status: editData.status,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('User updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedUser.user_id },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = inviteUserSchema.safeParse(inviteData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setInviting(true);
    try {
      const response = await supabase.functions.invoke('send-invitation', {
        body: {
          email: inviteData.email,
          role: inviteData.role,
          clearanceLevel: inviteData.clearanceLevel,
          department: inviteData.department || null,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      toast.success('Invitation sent successfully!');
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = createUserSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call edge function to create user
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          department: formData.department || null,
          badgeNumber: formData.badgeNumber || null,
          phone: formData.phone || null,
          clearanceLevel: formData.clearanceLevel,
          role: formData.role,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success('User created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const getUserRole = (userId: string) => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'No Role';
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'analyst': return 'bg-primary/20 text-primary border-primary/30';
      case 'viewer': return 'bg-success/20 text-success border-success/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getClearanceBadgeColor = (level: string) => {
    switch (level) {
      case 'top_secret': return 'bg-destructive/20 text-destructive';
      case 'secret': return 'bg-warning/20 text-warning';
      case 'confidential': return 'bg-primary/20 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/20 text-success';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'suspended': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-glow flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage platform users and their access levels
          </p>
        </div>

        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] p-0 bg-card border-primary/20 overflow-hidden">
              <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Add New User
                </DialogTitle>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="create" className="flex items-center gap-2 text-xs sm:text-sm">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden xs:inline">Create</span> User
                  </TabsTrigger>
                  <TabsTrigger value="invite" className="flex items-center gap-2 text-xs sm:text-sm">
                    <Mail className="h-4 w-4" />
                    <span className="hidden xs:inline">Invite</span> User
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="mt-0">
                  <ScrollArea className="max-h-[calc(95vh-200px)] pb-4">
                    <form onSubmit={handleCreateUser} className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="bg-background/50 h-10"
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="johndoe"
                      className="bg-background/50 h-10"
                    />
                  </div>
                  
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="agent@farsi.gov"
                      required
                      className="bg-background/50 h-10"
                    />
                  </div>
                  
                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      className="bg-background/50 h-10"
                    />
                  </div>
                  
                  {/* Department & Badge - 2 column on larger screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-sm font-medium">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="Cyber Security"
                        className="bg-background/50 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badgeNumber" className="text-sm font-medium">Badge Number</Label>
                      <Input
                        id="badgeNumber"
                        value={formData.badgeNumber}
                        onChange={(e) => setFormData({ ...formData, badgeNumber: e.target.value })}
                        placeholder="A-12345"
                        className="bg-background/50 h-10"
                      />
                    </div>
                  </div>
                  
                  {/* Phone & Clearance - 2 column on larger screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+254 700 000 000"
                        className="bg-background/50 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clearanceLevel" className="text-sm font-medium">Clearance Level</Label>
                      <Select
                        value={formData.clearanceLevel}
                        onValueChange={(value: any) => setFormData({ ...formData, clearanceLevel: value })}
                      >
                        <SelectTrigger className="bg-background/50 h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unclassified">Unclassified</SelectItem>
                          <SelectItem value="confidential">Confidential</SelectItem>
                          <SelectItem value="secret">Secret</SelectItem>
                          <SelectItem value="top_secret">Top Secret</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Role */}
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger className="bg-background/50 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Admin: Full access • Analyst: Create & edit data • Viewer: Read-only access
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full h-11" 
                      disabled={creating}
                    >
                      {creating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create User
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="invite" className="mt-0">
              <ScrollArea className="max-h-[calc(90vh-200px)] pb-4">
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Send an invitation email. The user will set up their own password and profile details.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email *</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      placeholder="user@example.com"
                      required
                      className="bg-background/50 h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select
                      value={inviteData.role}
                      onValueChange={(value: any) => setInviteData({ ...inviteData, role: value })}
                    >
                      <SelectTrigger className="bg-background/50 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Clearance Level</Label>
                      <Select
                        value={inviteData.clearanceLevel}
                        onValueChange={(value: any) => setInviteData({ ...inviteData, clearanceLevel: value })}
                      >
                        <SelectTrigger className="bg-background/50 h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unclassified">Unclassified</SelectItem>
                          <SelectItem value="confidential">Confidential</SelectItem>
                          <SelectItem value="secret">Secret</SelectItem>
                          <SelectItem value="top_secret">Top Secret</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        value={inviteData.department}
                        onChange={(e) => setInviteData({ ...inviteData, department: e.target.value })}
                        placeholder="Cyber Security"
                        className="bg-background/50 h-10"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button type="submit" className="w-full h-11" disabled={inviting}>
                      {inviting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </ScrollArea>
            </TabsContent>
          </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>
            <Badge variant="outline" className="text-muted-foreground w-fit">
              {filteredUsers.length} Users
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/20">
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Clearance</TableHead>
                      <TableHead>Badge</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-primary/10 hover:bg-primary/5">
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{user.department || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(getUserRole(user.user_id))}>
                            {getUserRole(user.user_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getClearanceBadgeColor(user.clearance_level)}>
                            {user.clearance_level.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {user.badge_number || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {user.user_id !== currentUser?.id && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(user)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="p-4 rounded-lg border border-primary/10 bg-background/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.user_id !== currentUser?.id && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className={getRoleBadgeColor(getUserRole(user.user_id))}>
                        {getUserRole(user.user_id)}
                      </Badge>
                      <Badge className={getClearanceBadgeColor(user.clearance_level)}>
                        {user.clearance_level.replace('_', ' ')}
                      </Badge>
                      <Badge className={getStatusBadgeColor(user.status)}>
                        {user.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="text-xs uppercase tracking-wider">Department</span>
                        <p className="text-foreground">{user.department || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider">Badge</span>
                        <p className="text-foreground font-mono">{user.badge_number || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit User
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={editData.fullName}
                  onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                  className="bg-background/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={editData.department}
                    onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Badge Number</Label>
                  <Input
                    value={editData.badgeNumber}
                    onChange={(e) => setEditData({ ...editData, badgeNumber: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="bg-background/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clearance Level</Label>
                  <Select
                    value={editData.clearanceLevel}
                    onValueChange={(value: any) => setEditData({ ...editData, clearanceLevel: value })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unclassified">Unclassified</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="secret">Secret</SelectItem>
                      <SelectItem value="top_secret">Top Secret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editData.role}
                    onValueChange={(value: any) => setEditData({ ...editData, role: value })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value: any) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>? 
              This action cannot be undone and will permanently remove the user account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
