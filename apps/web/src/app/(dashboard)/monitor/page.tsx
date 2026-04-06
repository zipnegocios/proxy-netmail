'use client';

import { useEffect, useState } from 'react';
import type { HealthSummary, Account } from '@proxy-netmail/shared';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import HealthStatusBadge from '@/components/health/health-status-badge';

export default function MonitorPage() {
  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<Record<number, boolean>>({});

  useEffect(() => {
    Promise.all([
      api<HealthSummary[]>('/api/health'),
      api<Account[]>('/api/accounts'),
    ])
      .then(([s, a]) => {
        setSummaries(s);
        setAccounts(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRunCheck = async (accountId: number) => {
    setChecking((prev) => ({ ...prev, [accountId]: true }));
    try {
      const summary = await api<HealthSummary>(
        `/api/health/${accountId}/check`,
        { method: 'POST' },
      );
      setSummaries((prev) =>
        prev.map((s) => (s.account_id === accountId ? summary : s)),
      );
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setChecking((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const summaryMap = Object.fromEntries(
    summaries.map((s) => [s.account_id, s]),
  );

  const stats = {
    total: accounts.length,
    healthy: accounts.filter((a) => {
      const s = summaryMap[a.id];
      return s && s.imap === 'ok' && s.smtp === 'ok' && s.pop3 === 'ok';
    }).length,
    degraded: accounts.filter((a) => {
      const s = summaryMap[a.id];
      if (!s) return false;
      const allOk = s.imap === 'ok' && s.smtp === 'ok' && s.pop3 === 'ok';
      const allFailed =
        (s.imap === null || (s.imap !== 'ok' && s.imap !== 'timeout' && s.imap !== 'refused')) &&
        (s.smtp === null || (s.smtp !== 'ok' && s.smtp !== 'timeout' && s.smtp !== 'refused')) &&
        (s.pop3 === null || (s.pop3 !== 'ok' && s.pop3 !== 'timeout' && s.pop3 !== 'refused'));
      return s && !allOk && !allFailed;
    }).length,
    failed: accounts.filter((a) => {
      const s = summaryMap[a.id];
      if (!s) return true;
      return (
        (s.imap === null || (s.imap !== 'ok' && s.imap !== 'timeout' && s.imap !== 'refused')) &&
        (s.smtp === null || (s.smtp !== 'ok' && s.smtp !== 'timeout' && s.smtp !== 'refused')) &&
        (s.pop3 === null || (s.pop3 !== 'ok' && s.pop3 !== 'timeout' && s.pop3 !== 'refused'))
      );
    }).length,
  };

  if (loading) {
    return <div className="text-gray-500">Loading health data...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Monitor</h2>
        <p className="text-gray-500 mt-1">Health status of all mail proxies</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Healthy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.healthy}</p>
            <p className="text-xs text-gray-500 mt-1">of {stats.total} accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Degraded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {stats.degraded}
            </p>
            <p className="text-xs text-gray-500 mt-1">of {stats.total} accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-500 mt-1">of {stats.total} accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No accounts configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const summary = summaryMap[account.id];
            return (
              <Card key={account.id}>
                <CardHeader>
                  <CardTitle className="text-base">{account.label}</CardTitle>
                  <p className="text-xs text-gray-500">{account.target_domain}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <HealthStatusBadge
                      status={summary?.imap ?? null}
                      label="IMAP"
                    />
                    <HealthStatusBadge
                      status={summary?.smtp ?? null}
                      label="SMTP"
                    />
                    <HealthStatusBadge
                      status={summary?.pop3 ?? null}
                      label="POP3"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {summary?.last_checked
                        ? `Checked ${new Date(
                            summary.last_checked,
                          ).toLocaleTimeString()}`
                        : 'Never checked'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checking[account.id]}
                      onClick={() => handleRunCheck(account.id)}
                    >
                      {checking[account.id] ? 'Checking...' : 'Run Check'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
