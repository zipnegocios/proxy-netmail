'use client';

import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from '@proxy-netmail/shared';

interface HealthStatusBadgeProps {
  status: HealthStatus | null;
  label?: string;
}

export default function HealthStatusBadge({
  status,
  label,
}: HealthStatusBadgeProps) {
  const getColorClass = (): string => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'timeout':
      case 'refused':
        return 'bg-orange-100 text-orange-800';
      case 'ssl_error':
      case 'auth_error':
      case 'unknown':
        return 'bg-red-100 text-red-800';
      case null:
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const displayText = status || '—';
  const text = label ? `${label}: ${displayText}` : displayText;

  return (
    <Badge className={getColorClass()} variant="secondary">
      {text}
    </Badge>
  );
}
