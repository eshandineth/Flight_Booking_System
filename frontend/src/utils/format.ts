export function formatPrice(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-LK')}`;
}

export function formatFlightDateTime(isoWallClock: string): {
  dateLabel: string;
  timeLabel: string;
  inputValue: string;
} {
  // Expected format: YYYY-MM-DDTHH:mm(:ss)
  const clean = isoWallClock.replace(' ', 'T');
  const [datePart = '', timePart = '00:00'] = clean.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);

  const d = new Date(year, (month || 1) - 1, day || 1, hour, minute);
  const dateLabel = Number.isNaN(d.getTime())
    ? datePart
    : d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0'
  )}`;

  const inputValue = `${datePart}T${timeLabel}`;
  return { dateLabel, timeLabel, inputValue };
}

