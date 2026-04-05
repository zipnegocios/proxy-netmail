'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateAccountDto } from '@proxy-netmail/shared';

interface AccountFormProps {
  onSubmit: (data: CreateAccountDto) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function AccountForm({ onSubmit, onCancel, loading }: AccountFormProps) {
  const [form, setForm] = useState<CreateAccountDto>({
    label: '',
    target_domain: '',
    imap_upstream: 'imap.hostinger.com',
    smtp_upstream: 'smtp.hostinger.com',
    pop_upstream: 'pop.hostinger.com',
    imap_port: 993,
    smtp_port: 465,
    pop_port: 995,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const update = (field: keyof CreateAccountDto, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            placeholder="My Email Account"
            value={form.label}
            onChange={(e) => update('label', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target_domain">Domain</Label>
          <Input
            id="target_domain"
            placeholder="example.com"
            value={form.target_domain}
            onChange={(e) => update('target_domain', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="imap_upstream">IMAP Upstream</Label>
          <Input
            id="imap_upstream"
            value={form.imap_upstream}
            onChange={(e) => update('imap_upstream', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp_upstream">SMTP Upstream</Label>
          <Input
            id="smtp_upstream"
            value={form.smtp_upstream}
            onChange={(e) => update('smtp_upstream', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pop_upstream">POP3 Upstream</Label>
          <Input
            id="pop_upstream"
            value={form.pop_upstream}
            onChange={(e) => update('pop_upstream', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="imap_port">IMAP Port</Label>
          <Input
            id="imap_port"
            type="number"
            value={form.imap_port}
            onChange={(e) => update('imap_port', parseInt(e.target.value, 10))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp_port">SMTP Port</Label>
          <Input
            id="smtp_port"
            type="number"
            value={form.smtp_port}
            onChange={(e) => update('smtp_port', parseInt(e.target.value, 10))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pop_port">POP3 Port</Label>
          <Input
            id="pop_port"
            type="number"
            value={form.pop_port}
            onChange={(e) => update('pop_port', parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </Button>
      </div>
    </form>
  );
}
