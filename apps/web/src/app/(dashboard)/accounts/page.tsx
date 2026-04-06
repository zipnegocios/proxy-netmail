'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AccountForm } from '@/components/accounts/account-form';
import { api } from '@/lib/api';
import type { Account, CreateAccountDto } from '@proxy-netmail/shared';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchAccounts = async () => {
    try {
      const data = await api<Account[]>('/api/accounts');
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (data: CreateAccountDto) => {
    setCreating(true);
    try {
      await api<Account>('/api/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setDialogOpen(false);
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to create account:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      await api(`/api/accounts/${id}`, { method: 'DELETE' });
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'stopped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounts</h2>
          <p className="text-gray-500 mt-1">Manage your mail proxy accounts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Account</DialogTitle>
            </DialogHeader>
            <AccountForm
              onSubmit={handleCreate}
              onCancel={() => setDialogOpen(false)}
              loading={creating}
            />
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No accounts configured yet.</p>
            <Button onClick={() => setDialogOpen(true)}>Add your first account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{account.label}</CardTitle>
                  <p className="text-sm text-gray-500">{account.target_domain}</p>
                </div>
                <Badge className={statusColor(account.proxy_status)} variant="secondary">
                  {account.proxy_status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">IMAP:</span>{' '}
                    {account.imap_upstream}:{account.imap_port}
                  </div>
                  <div>
                    <span className="text-gray-500">SMTP:</span>{' '}
                    {account.smtp_upstream}:{account.smtp_port}
                  </div>
                  <div>
                    <span className="text-gray-500">POP3:</span>{' '}
                    {account.pop_upstream}:{account.pop_port}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/accounts/detail?id=${account.id}`}>Details</Link>
                  </Button>
                  {account.proxy_status !== 'running' && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/accounts/detail?id=${account.id}`}>Setup</Link>
                    </Button>
                  )}
                  {account.proxy_status === 'running' && (
                    <Badge className="bg-green-100 text-green-800" variant="secondary">
                      Running
                    </Badge>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(account.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
