import React, { useState } from 'react';
import { REPORT_CATEGORIES, ReportTargetType, submitReport } from '../lib/reports';

interface ReportContentDialogProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportTargetType;
  subject?: string;
  metadata?: Record<string, unknown>;
}

export function ReportContentDialog({
  open,
  onClose,
  targetId,
  targetType,
  subject,
  metadata,
}: ReportContentDialogProps) {
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0].value);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) {
    return null;
  }

  const friendlySubject = subject || {
    user: 'this user',
    item: 'this item',
    message: 'this message',
    comment: 'this comment',
    other: 'this content',
  }[targetType];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await submitReport({
        targetType,
        targetId,
        category,
        description: description.trim() || undefined,
        metadata: {
          source: 'web',
          path: window.location.pathname,
          ...metadata,
        },
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        setCategory(REPORT_CATEGORIES[0].value);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while submitting the report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Report {friendlySubject}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close report dialog"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Tell us what&apos;s wrong. Our moderators review every report within 24 hours and remove any content that
          violates community guidelines.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Category</label>
            <div className="mt-2 space-y-2">
              {REPORT_CATEGORIES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                    category === option.value
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() => setCategory(option.value)}
                    className="mr-3 h-4 w-4 text-red-600 focus:ring-red-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="report-description" className="text-sm font-medium text-gray-700">
              Additional details (optional)
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Provide any additional context that might help our moderation team."
            />
            <div className="mt-1 text-xs text-gray-400 text-right">
              {description.length}/500
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Report submitted. Thank you!</div>}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

