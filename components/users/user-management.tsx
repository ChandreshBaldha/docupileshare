'use client'

import { useState } from 'react'
import { UserPlus, Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

interface User { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string }

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'destructive',
  ADMIN: 'info',
  MANAGER: 'success',
  VIEWER: 'muted',
}

export function UserManagement({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MANAGER' })

  async function createUser() {
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setUsers(prev => [data.data, ...prev])
      toast({ title: 'User created' })
      setOpen(false)
      setForm({ name: '', email: '', password: '', role: 'MANAGER' })
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setSaving(false)
  }

  async function toggleActive(userId: string, isActive: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !isActive } : u))
      toast({ title: isActive ? 'User deactivated' : 'User activated' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage system users and their roles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={role => setForm(f => ({ ...f, role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createUser} disabled={saving || !form.name || !form.email || !form.password}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Login</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={(ROLE_COLORS[u.role] ?? 'outline') as any} className="text-xs">
                      {u.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="h-3.5 w-3.5" />Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(u.id, u.isActive)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
