import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Payment, Player, PaymentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const statusVariant: Record<PaymentStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'destructive',
};

interface Props {
  payment: Payment | null;
  player: Player | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export default function PaymentDialog({ payment, player, onOpenChange, onChanged }: Props) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProofUrl(null);
    setProofError('');
    if (!payment?.proof_image_path) return;
    // Private bucket: admin-only signed URL, short-lived. Never a public URL.
    supabase.storage
      .from('payment-proofs')
      .createSignedUrl(payment.proof_image_path, 300)
      .then(({ data, error }) => {
        if (error) setProofError('Could not load proof image.');
        else setProofUrl(data.signedUrl);
      });
  }, [payment]);

  async function setStatus(status: PaymentStatus) {
    if (!payment) return;
    setSaving(true);
    const { error } = await supabase.from('payments').update({ status }).eq('id', payment.id);
    setSaving(false);
    if (error) {
      alert(`Could not update payment: ${error.message}`);
      return;
    }
    onOpenChange(false);
    onChanged();
  }

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment review</DialogTitle>
          <DialogDescription>{player?.full_name}</DialogDescription>
        </DialogHeader>
        {payment && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium">₱{payment.amount}</p>
              <p className="text-muted-foreground">Method</p>
              <p className="font-medium uppercase">{payment.method}</p>
              <p className="text-muted-foreground">Reference</p>
              <p className="font-medium">{payment.reference_number || '—'}</p>
              <p className="text-muted-foreground">Status</p>
              <p>
                <Badge variant={statusVariant[payment.status]}>{payment.status}</Badge>
              </p>
            </div>
            {payment.proof_image_path &&
              (proofUrl ? (
                <a href={proofUrl} target="_blank" rel="noreferrer">
                  <img
                    src={proofUrl}
                    alt="Proof of payment"
                    className="max-h-80 w-full rounded-md border border-border object-contain"
                  />
                </a>
              ) : (
                <p className="text-muted-foreground">{proofError || 'Loading proof image…'}</p>
              ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                disabled={saving || payment.status === 'rejected'}
                onClick={() => setStatus('rejected')}
              >
                Reject
              </Button>
              <Button
                disabled={saving || payment.status === 'verified'}
                onClick={() => setStatus('verified')}
              >
                Verify
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
