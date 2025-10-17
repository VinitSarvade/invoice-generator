'use client';

import { useEffect, useMemo, useState } from 'react';
import { InvoicePayload, InvoiceTotals } from '@/types/invoice';
import { formatCurrency } from '@/lib/format';

interface EmailInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoicePayload | null;
  totals: InvoiceTotals;
  senderEmail: string;
  onSenderEmailChange: (email: string) => void;
  copyEmail: string;
  onCopyEmailChange: (email: string) => void;
  onSend: (payload: {
    to: string;
    subject: string;
    message: string;
    copyToSelf: boolean;
  }) => Promise<void>;
}

export const EmailInvoiceModal = ({
  open,
  onClose,
  invoice,
  totals,
  senderEmail,
  onSenderEmailChange,
  copyEmail,
  onCopyEmailChange,
  onSend
}: EmailInvoiceModalProps) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [copyToSelf, setCopyToSelf] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (open && invoice) {
      const defaultSubject = `Invoice ${invoice.invoiceNumber}`;
      const formattedTotal = formatCurrency(totals.total, invoice.currency);
      const defaultMessage = `Hi ${invoice.customer.name},\n\nPlease find attached invoice ${invoice.invoiceNumber} for ${formattedTotal}.\n\nIf you have any questions, feel free to reply to this email.\n\nThank you!`;

      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setTo(invoice.customer.email ?? '');
      setCopyToSelf(Boolean(copyEmail));
      setFeedback(null);
    }
  }, [open, invoice, totals.total, copyEmail]);

  const canSend = useMemo(() => {
    return Boolean(invoice && to && subject && message && senderEmail);
  }, [invoice, to, subject, message, senderEmail]);

  const handleSend = async () => {
    if (!canSend) {
      setFeedback({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    setIsSending(true);
    setFeedback(null);
    try {
      await onSend({
        to,
        subject,
        message,
        copyToSelf
      });
      setFeedback({ type: 'success', text: 'Invoice email has been queued successfully.' });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (error) {
      setFeedback({ type: 'error', text: 'Unable to send email. Please try again.' });
    } finally {
      setIsSending(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Email Invoice</h2>
            <p style={{ color: 'var(--color-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
              Send <span className="badge">{invoice?.invoiceNumber}</span> directly to your customer.
            </p>
          </div>
          <button className="secondary" onClick={onClose} style={{ padding: '0.5rem 0.9rem' }}>
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="email-to">Send to</label>
            <input
              id="email-to"
              type="email"
              placeholder="customer@example.com"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="email-subject">Subject</label>
            <input
              id="email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="email-message">Message</label>
            <textarea
              id="email-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              required
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              The invoice PDF will be attached automatically.
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'rgba(37, 99, 235, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="copy-to-self"
                type="checkbox"
                checked={copyToSelf}
                onChange={(event) => setCopyToSelf(event.target.checked)}
              />
              <label htmlFor="copy-to-self" style={{ margin: 0, cursor: 'pointer' }}>
                Send a copy to myself
              </label>
            </div>

            {copyToSelf && (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label htmlFor="copy-email">My email address</label>
                <input
                  id="copy-email"
                  type="email"
                  placeholder="you@example.com"
                  value={copyEmail}
                  onChange={(event) => onCopyEmailChange(event.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="sender-email">Sender email</label>
            <input
              id="sender-email"
              type="email"
              placeholder="billing@yourcompany.com"
              value={senderEmail}
              onChange={(event) => onSenderEmailChange(event.target.value)}
              required
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              This address will appear as the sender of the message.
            </span>
          </div>
        </div>

        {feedback && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              color: feedback.type === 'error' ? '#991b1b' : '#166534',
              background:
                feedback.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.16)'
            }}
          >
            {feedback.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="secondary" onClick={onClose} disabled={isSending}>
            Cancel
          </button>
          <button className="primary" onClick={handleSend} disabled={isSending || !canSend}>
            {isSending ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};
