'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import clsx from 'clsx';
import { formatCurrency } from '@/lib/format';
import type { InvoicePayload, InvoiceTotals } from '@/types/invoice';

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

interface EmailFormValues {
  to: string;
  subject: string;
  message: string;
  copyToSelf: boolean;
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
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );
  const [isSending, setIsSending] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    defaultValues: {
      to: '',
      subject: '',
      message: '',
      copyToSelf: false
    }
  });
  const EmailField = emailForm.Field;

  useEffect(() => {
    if (open && invoice) {
      const formattedTotal = formatCurrency(totals.total, invoice.currency);
      emailForm.reset(
        {
          to: invoice.customer.email ?? '',
          subject: `Invoice ${invoice.invoiceNumber}`,
          message: `Hi ${invoice.customer.name},\n\nPlease find attached invoice ${invoice.invoiceNumber} for ${formattedTotal}.\n\nIf you have any questions, feel free to reply to this email.\n\nThank you!`,
          copyToSelf: Boolean(copyEmail)
        },
        { keepDefaultValues: true }
      );
      setFeedback(null);
    }
  }, [open, invoice, totals.total, copyEmail, emailForm]);

  const formValues = emailForm.useStore((state) => state.values);
  const canSend = useMemo(() => {
    return Boolean(invoice && formValues.to && formValues.subject && formValues.message && senderEmail);
  }, [invoice, formValues.to, formValues.subject, formValues.message, senderEmail]);

  const handleSubmit = async () => {
    if (!canSend) {
      setFeedback({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    setIsSending(true);
    setFeedback(null);
    try {
      await onSend({
        to: formValues.to,
        subject: formValues.subject,
        message: formValues.message,
        copyToSelf: formValues.copyToSelf
      });
      setFeedback({ type: 'success', text: 'Invoice email has been queued successfully.' });
      setTimeout(() => {
        onClose();
      }, 800);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Email invoice</h2>
            <p className="mt-1 text-sm text-slate-500">
              Send{' '}
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {invoice?.invoiceNumber ?? 'Draft'}
              </span>{' '}
              directly to your customer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <EmailField name="to">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-500">Recipient</label>
                <input
                  id="email-to"
                  type="email"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="customer@example.com"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </EmailField>

          <EmailField name="subject">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-500">Subject</label>
                <input
                  id="email-subject"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </EmailField>

          <EmailField name="message">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase text-slate-500">Message</label>
                <textarea
                  id="email-message"
                  rows={6}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <span className="text-xs text-slate-400">The invoice PDF will be attached automatically.</span>
              </div>
            )}
          </EmailField>

          <EmailField name="copyToSelf">
            {(field) => (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      field.handleChange(checked);
                      if (!checked) {
                        onCopyEmailChange('');
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Send a copy to myself
                </label>
                {field.state.value && (
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      My email address
                    </label>
                    <input
                      type="email"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="you@example.com"
                      value={copyEmail}
                      onChange={(event) => onCopyEmailChange(event.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </EmailField>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Sender email</label>
            <input
              id="sender-email"
              type="email"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="billing@yourcompany.com"
              value={senderEmail}
              onChange={(event) => onSenderEmailChange(event.target.value)}
            />
            <span className="text-xs text-slate-400">
              This address will appear as the sender of the message.
            </span>
          </div>
        </div>

        {feedback && (
          <div
            className={clsx(
              'mt-6 rounded-md px-4 py-3 text-sm',
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            )}
          >
            {feedback.text}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSending || !canSend}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500',
              (isSending || !canSend) && 'cursor-not-allowed opacity-70'
            )}
          >
            {isSending ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};
