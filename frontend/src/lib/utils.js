export function fmtDate(d) {
  if (!d) return '–';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function daysPending(recvDate, rmResolved, companyResolved) {
  if (rmResolved && companyResolved) return null;
  if (!recvDate) return null;
  const start = new Date(recvDate + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - start) / 86400000);
  return diff >= 0 ? diff : 0;
}

export function getBucket(days) {
  if (days === null) return 'resolved';
  if (days < 3)  return 'hot';
  if (days <= 15) return 'warm';
  return 'cold';
}

export function getDumpStatus(resolved, total) {
  if (total === 0) return 'Pending';
  if (resolved === total) return 'Completed';
  if (resolved > 0) return 'In Progress';
  return 'Pending';
}

export function progressColor(pct) {
  if (pct === 100) return '#1a7a4a';
  if (pct >= 50)   return '#1a4fcf';
  return '#8a5500';
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}