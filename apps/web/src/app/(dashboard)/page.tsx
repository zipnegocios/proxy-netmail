'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import ActivityFeed from '@/components/activity/activity-feed';
import type { Account } from '@proxy-netmail/shared';

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Account[]>('/api/accounts')
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = {
    total: accounts.length,
    running: accounts.filter((a) => a.proxy_status === 'running').length,
    pending: accounts.filter((a) => a.proxy_status === 'pending').length,
    error: accounts.filter((a) => a.proxy_status === 'error').length,
    stopped: accounts.filter((a) => a.proxy_status === 'stopped').length,
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
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of your mail proxy accounts</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{statusCounts.running}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{statusCounts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{statusCounts.error}</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No accounts yet. Go to Accounts to add your first proxy.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-gray-500">Label</th>
                    <th className="pb-3 font-medium text-gray-500">Domain</th>
                    <th className="pb-3 font-medium text-gray-500">Status</th>
                    <th className="pb-3 font-medium text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.slice(0, 10).map((account) => (
                    <tr key={account.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{account.label}</td>
                      <td className="py-3 text-gray-600">{account.target_domain}</td>
                      <td className="py-3">
                        <Badge className={statusColor(account.proxy_status)} variant="secondary">
                          {account.proxy_status}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(account.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed />
        </CardContent>
      </Card>
    </div>
  );
}
