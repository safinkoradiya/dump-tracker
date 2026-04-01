export const RENEWAL_BUCKET_LABELS = {
  expired_30_plus: 'Expired 30+ Days',
  expired_16_30: 'Expired 16-30 Days',
  expired_1_15: 'Expired 1-15 Days',
  due_today: 'Due Today',
  due_1_7: 'Due in 1-7 Days',
  due_8_15: 'Due in 8-15 Days',
  due_16_30: 'Due in 16-30 Days',
  due_31_plus: 'Due in 31+ Days',
  renewed: 'Renewed',
  unknown: 'Unknown',
};

export const RENEWAL_STATUS_OPTIONS = [
  'Pending',
  'Quoted',
  'Follow-up',
  'Rejected',
  'Renewed',
  'No Response',
];

export const CUSTOMER_RESPONSE_OPTIONS = [
  'No Response',
  'Interested',
  'Follow-up Needed',
  'Rejected',
  'Renewed',
];

export function renewalDays(policyValidTill) {
  if (!policyValidTill) return null;
  const end = new Date(`${policyValidTill.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((end - today) / 86400000);
}

export function renewalBucket(days, status) {
  if (status === 'Renewed') return 'renewed';
  if (days === null || days === undefined) return 'unknown';
  if (days < -30) return 'expired_30_plus';
  if (days <= -16) return 'expired_16_30';
  if (days <= -1) return 'expired_1_15';
  if (days === 0) return 'due_today';
  if (days <= 7) return 'due_1_7';
  if (days <= 15) return 'due_8_15';
  if (days <= 30) return 'due_16_30';
  return 'due_31_plus';
}

export function decorateRenewal(renewal) {
  const days_to_renewal = renewal.days_to_renewal ?? renewalDays(renewal.policy_valid_till);
  const bucket = renewal.bucket || renewalBucket(days_to_renewal, renewal.status);
  return {
    ...renewal,
    days_to_renewal,
    bucket,
    is_due_soon: renewal.is_due_soon ?? (renewal.status !== 'Renewed' && days_to_renewal !== null && days_to_renewal >= 0 && days_to_renewal <= 30),
    is_expired: renewal.is_expired ?? (renewal.status !== 'Renewed' && days_to_renewal !== null && days_to_renewal < 0),
  };
}

export function renewalBucketClass(bucket) {
  if (bucket === 'renewed') return 'resolved';
  if (bucket.startsWith('expired')) return 'cold';
  if (bucket === 'due_today' || bucket === 'due_1_7') return 'pending';
  if (bucket === 'due_8_15' || bucket === 'due_16_30') return 'warm';
  if (bucket === 'due_31_plus') return 'hot';
  return 'progress';
}

export function renewalBucketVariant(bucket) {
  if (bucket === 'renewed' || bucket === 'due_31_plus') return 'green';
  if (bucket === 'due_8_15' || bucket === 'due_16_30') return 'accent';
  if (bucket === 'due_today' || bucket === 'due_1_7') return 'amber';
  return 'red';
}

export function renewalStatusClass(status) {
  if (status === 'Renewed') return 'resolved';
  if (status === 'Rejected') return 'cold';
  if (status === 'Quoted' || status === 'Follow-up') return 'warm';
  if (status === 'No Response') return 'pending';
  return 'progress';
}

export function renewalDaysLabel(days) {
  if (days === null || days === undefined) return '–';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}
