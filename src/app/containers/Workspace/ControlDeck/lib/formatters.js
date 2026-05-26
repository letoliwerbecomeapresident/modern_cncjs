export const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : '0.000';
};

export const formatRuntime = (seconds) => {
  seconds = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
};

export const getProgress = (senderStatus) => {
  const total = Number(senderStatus.total || 0);
  const sent = Number(senderStatus.sent || 0);

  if (!total) {
    return 0;
  }

  return Math.min(100, Math.round((sent / total) * 100));
};
