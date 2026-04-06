'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Account, SslCertificate, HealthCheck, HealthSummary } from '@proxy-netmail/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import SetupProgress from '@/components/setup/setup-progress';
import ActivityFeed from '@/components/activity/activity-feed';
import HealthStatusBadge from '@/components/health/health-status-badge';

export default function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ssl, setSsl] = useState<SslCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'ssl' | 'activity' | 'health'>(
    'info',
  );
  const [stopping, setStopping] = useState(false);
  const [healthHistory, setHealthHistory] = useState<HealthCheck[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  const accountId = parseInt(params.id, 10);

  const fetchData = async () => {
    try {
      const [acc, cert] = await Promise.all([
        api<Account>(`/api/accounts/${accountId}`),
        api<SslCertificate | null>(`/api/ssl/${accountId}`).catch(
          () => null,
        ),
      ]);
      setAccount(acc);
      setSsl(cert);
    } catch (error) {
      console.error('Failed to fetch account:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accountId]);

  useEffect(() => {
    if (activeTab !== 'health') return;
    setHealthLoading(true);
    Promise.all([
      api<HealthCheck[]>(`/api/health/${accountId}`),
      api<HealthSummary[]>('/api/health').then((all) =>
        all.find((s) => s.account_id === accountId) ?? null,
      ),
    ])
      .then(([history, summary]) => {
        setHealthHistory(history);
        setHealthSummary(summary);
      })
      .catch(console.error)
      .finally(() => setHealthLoading(false));
  }, [activeTab, accountId]);

  const handleSetupComplete = async () => {
    setSetupRunning(false);
    setSetupDone(true);
    // Refetch account to update status
    await fetchData();
  };

  const handleSetupError = () => {
    setSetupRunning(false);
  };

  const handleStopProxy = async () => {
    if (
      !confirm(
        'Are you sure you want to stop this proxy? It will no longer handle email traffic.',
      )
    ) {
      return;
    }

    setStopping(true);
    try {
      await api(`/api/accounts/${accountId}/stop`, { method: 'POST' });
      setSetupDone(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to stop proxy:', error);
      alert('Failed to stop proxy');
    } finally {
      setStopping(false);
    }
  };

  const statusColor =
    account?.proxy_status === 'running'
      ? 'bg-green-100 text-green-800'
      : account?.proxy_status === 'error'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800';

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Account not found</h2>
          <Link href="/accounts">
            <Button>Back to Accounts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{account.label}</h1>
          <p className="text-gray-600 mt-1">{account.target_domain}</p>
        </div>
        <Link href="/accounts">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {/* Setup Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Proxy Status
                <Badge className={statusColor}>
                  {account.proxy_status}
                </Badge>
              </CardTitle>
            </div>
            {account.proxy_status === 'running' && (
              <Button
                variant="destructive"
                onClick={handleStopProxy}
                disabled={stopping}
              >
                {stopping ? 'Stopping...' : 'Stop Proxy'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!setupRunning && account.proxy_status !== 'running' && (
            <Button
              onClick={() => setSetupRunning(true)}
              className="w-full"
              size="lg"
            >
              Start Setup
            </Button>
          )}

          {setupRunning && (
            <SetupProgress
              accountId={accountId}
              onComplete={handleSetupComplete}
              onError={handleSetupError}
            />
          )}

          {setupDone && account.proxy_status === 'running' && (
            <div className="text-green-700 p-4 bg-green-50 rounded border border-green-200">
              ✓ Setup completed successfully
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Account Info
          </button>
          <button
            onClick={() => setActiveTab('ssl')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'ssl'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            SSL Certificate
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'health'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Health
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle>Account Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Label
                </label>
                <p className="mt-1">{account.label}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Domain
                </label>
                <p className="mt-1">{account.target_domain}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  IMAP
                </label>
                <p className="mt-1">
                  {account.imap_upstream}:{account.imap_port}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  SMTP
                </label>
                <p className="mt-1">
                  {account.smtp_upstream}:{account.smtp_port}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  POP3
                </label>
                <p className="mt-1">
                  {account.pop_upstream}:{account.pop_port}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Created
                </label>
                <p className="mt-1">
                  {new Date(account.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ssl' && (
        <Card>
          <CardHeader>
            <CardTitle>SSL Certificate</CardTitle>
          </CardHeader>
          <CardContent>
            {ssl ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Domain
                  </label>
                  <p className="mt-1">{ssl.domain}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Status
                  </label>
                  <p className="mt-1">
                    <Badge
                      className={
                        ssl.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {ssl.status}
                    </Badge>
                  </p>
                </div>
                {ssl.issued_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Issued At
                    </label>
                    <p className="mt-1">
                      {new Date(ssl.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {ssl.expires_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Expires At
                    </label>
                    <p className="mt-1">
                      {new Date(ssl.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {ssl.cert_path && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Cert Path
                    </label>
                    <p className="mt-1 text-xs break-all font-mono">
                      {ssl.cert_path}
                    </p>
                  </div>
                )}
                {ssl.key_path && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Key Path
                    </label>
                    <p className="mt-1 text-xs break-all font-mono">
                      {ssl.key_path}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No SSL certificate yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed accountId={accountId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'health' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Health Status</CardTitle>
              <Button
                size="sm"
                disabled={runningCheck}
                onClick={async () => {
                  setRunningCheck(true);
                  try {
                    const summary = await api<HealthSummary>(
                      `/api/health/${accountId}/check`,
                      { method: 'POST' },
                    );
                    setHealthSummary(summary);
                    const history = await api<HealthCheck[]>(
                      `/api/health/${accountId}`,
                    );
                    setHealthHistory(history);
                  } catch (err) {
                    console.error('Health check failed:', err);
                  } finally {
                    setRunningCheck(false);
                  }
                }}
              >
                {runningCheck ? 'Checking...' : 'Run Health Check'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="text-gray-500 text-center py-8">
                Loading health data...
              </div>
            ) : (
              <>
                <div className="flex gap-3 mb-6 flex-wrap">
                  <HealthStatusBadge
                    status={healthSummary?.imap ?? null}
                    label="IMAP"
                  />
                  <HealthStatusBadge
                    status={healthSummary?.smtp ?? null}
                    label="SMTP"
                  />
                  <HealthStatusBadge
                    status={healthSummary?.pop3 ?? null}
                    label="POP3"
                  />
                </div>
                {healthSummary?.last_checked && (
                  <p className="text-xs text-gray-500 mb-4">
                    Last checked:{' '}
                    {new Date(
                      healthSummary.last_checked,
                    ).toLocaleString()}
                  </p>
                )}

                <h4 className="text-sm font-medium mb-2">Recent Checks</h4>
                {healthHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No checks yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-gray-500">
                            Time
                          </th>
                          <th className="pb-2 font-medium text-gray-500">
                            Protocol
                          </th>
                          <th className="pb-2 font-medium text-gray-500">
                            Status
                          </th>
                          <th className="pb-2 font-medium text-gray-500">
                            Latency
                          </th>
                          <th className="pb-2 font-medium text-gray-500">
                            Detail
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthHistory.slice(0, 10).map((check) => (
                          <tr key={check.id} className="border-b last:border-0">
                            <td className="py-2 text-gray-500">
                              {new Date(
                                check.checked_at,
                              ).toLocaleTimeString()}
                            </td>
                            <td className="py-2 uppercase font-mono">
                              {check.protocol}
                            </td>
                            <td className="py-2">
                              <HealthStatusBadge status={check.status} />
                            </td>
                            <td className="py-2">
                              {check.latency_ms != null
                                ? `${check.latency_ms}ms`
                                : '—'}
                            </td>
                            <td className="py-2 text-gray-500 max-w-32 truncate">
                              {check.error_detail ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
