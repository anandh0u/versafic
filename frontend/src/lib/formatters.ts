export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const numberFormatter = new Intl.NumberFormat('en-IN');

export const compactNumberFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

export const formatCredits = (credits: number): string => `${numberFormatter.format(credits)} credits`;

export const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export const formatDate = (value?: string): string => {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

export const formatCompact = (value: number): string => compactNumberFormatter.format(value);

export const clampPercentage = (value: number): number => Math.max(0, Math.min(100, value));
