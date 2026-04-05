'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react';
import type { SetupEvent } from '@proxy-netmail/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupProgressProps {
  accountId: number;
  onComplete: () => void;
  onError: () => void;
}

const STEPS = [
  { step: 1, name: 'DNS Verification' },
  { step: 2, name: 'Write Initial Config' },
  { step: 3, name: 'Backup Config' },
  { step: 4, name: 'Issue SSL Certificate' },
  { step: 5, name: 'Write SSL Config' },
  { step: 6, name: 'Update SSL Record' },
  { step: 7, name: 'Activate Proxy' },
];

export default function SetupProgress({
  accountId,
  onComplete,
  onError,
}: SetupProgressProps) {
  const [events, setEvents] = useState<SetupEvent[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/accounts/${accountId}/setup`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim();
            if (!line || line.startsWith(':')) continue;

            try {
              const event: SetupEvent = JSON.parse(line);
              setEvents((prev) => [...prev, event]);

              if (event.status === 'done') {
                setIsRunning(false);
                onComplete();
              } else if (event.status === 'error') {
                setIsRunning(false);
                setError(event.message);
                onError();
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Setup stream error:', errorMsg);
          setError(errorMsg);
          setIsRunning(false);
          onError();
        }
      }
    })();

    return () => controller.abort();
  }, [accountId, onComplete, onError]);

  const getStepStatus = (
    stepNum: number,
  ): 'pending' | 'running' | 'success' | 'error' => {
    const event = events.find((e) => e.step === stepNum);
    if (!event) return 'pending';
    if (event.status === 'running') return 'running';
    if (event.status === 'error') return 'error';
    if (event.status === 'success' || event.status === 'done')
      return 'success';
    return 'pending';
  };

  const getStepMessage = (stepNum: number): string => {
    const event = events.find((e) => e.step === stepNum);
    return event?.message ?? '';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Circle className="h-5 w-5 text-gray-400" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Setup Progress
          {isRunning && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {STEPS.map(({ step, name }) => {
            const status = getStepStatus(step);
            const message = getStepMessage(step);
            return (
              <div key={step} className="flex gap-4">
                <div className="flex-shrink-0">
                  {getStepIcon(status)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{name}</p>
                  {message && (
                    <p
                      className={`text-xs mt-1 ${
                        status === 'error'
                          ? 'text-red-600'
                          : status === 'success'
                            ? 'text-green-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <p className="font-medium">Setup Failed</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!isRunning && !error && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              <p className="font-medium">Setup Complete</p>
              <p className="mt-1">
                Your proxy is now running and ready to handle email traffic.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
