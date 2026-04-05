'use client';

import { useEffect, useState } from 'react';
import type { ActivityLogEntry, Severity } from '@proxy-netmail/shared';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface ActivityFeedProps {
  accountId?: number;
}

export default function ActivityFeed({ accountId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const path = accountId
          ? `/api/activity/accounts/${accountId}`
          : '/api/activity';
        const data = await api<ActivityLogEntry[]>(path);
        setEntries(data);
      } catch (error) {
        console.error('Failed to fetch activity:', error);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [accountId]);

  const severityColor = (
    severity: Severity,
  ): string => {
    switch (severity) {
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading activity...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded text-sm"
        >
          <span className="text-xs text-gray-500 whitespace-nowrap pt-0.5">
            {new Date(entry.created_at).toLocaleTimeString()}
          </span>
          <Badge
            className={`text-xs flex-shrink-0 ${severityColor(
              entry.severity,
            )}`}
            variant="secondary"
          >
            {entry.severity}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs text-gray-700">
              {entry.event_type}
            </p>
            <p className="text-xs text-gray-600 mt-0.5 break-words">
              {entry.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
