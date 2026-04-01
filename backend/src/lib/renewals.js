import XLSX from 'xlsx';

const KEY_FIELD_HINTS = new Set([
  'policy_number',
  'original_policy_number',
  'vehicle_number',
  'policy_valid_till',
  'policy_valid_from',
  'insurer',
  'source_rm',
  'latest_rm',
  'rm_name',
  'policy_holder_name',
  'inwarding_date',
]);

const FIELD_CANDIDATES = {
  policy_number: ['policy_number', 'policy_no', 'policy_no_', 'policy', 'policyid'],
  original_policy_number: ['original_policy_number', 'old_policy_number', 'previous_policy_number'],
  policy_holder_name: ['policy_holder_name', 'customer_name', 'insured_name', 'name'],
  policy_holder_phone: ['policy_holder_phone_no', 'policy_holder_phone', 'mobile_no', 'phone_no', 'mobile', 'contact_no', 'contact_number'],
  policy_holder_email: ['policy_holder_email', 'email', 'email_id', 'mail_id'],
  insurer: ['insurer', 'insurance_company', 'company'],
  broker_name: ['broker_name', 'broker'],
  broker_code: ['broker_code'],
  source_rm: ['source_rm', 'rm_name', 'rm', 'source_login_id', 'loginid'],
  latest_rm: ['latest_rm', 'latest_rm_name', 'rm_latest', 'assigned_rm'],
  source_partner: ['source_partner', 'partner_name', 'partner'],
  source_partner_code: ['source_partner_code', 'partner_code'],
  source_partner_type: ['source_partner_type', 'partner_type'],
  vehicle_number: ['vehicle_number', 'registration_number', 'reg_no', 'registration_no', 'vehicle_no'],
  vehicle_make: ['vehicle_make', 'make'],
  vehicle_model: ['vehicle_model', 'model'],
  vehicle_variant: ['vehicle_variant', 'variant'],
  year_of_manufacture: ['year_of_manufacture', 'manufacture_year'],
  policy_type: ['policy_type'],
  vehicle_class: ['vehicle_class'],
  vehicle_subclass: ['vehicle_subclass', 'vehicle_sub_class'],
  subclass_name: ['subclass__name', 'subclass_name'],
  vehicle_cc: ['vehicle_cc', 'cc'],
  vehicle_gvw: ['vehicle_gvw', 'gvw'],
  pivot_points: ['pivot_points'],
  seating_capacity: ['seating_capacity'],
  fuel_type: ['vehicle_fuel_type', 'fuel_type'],
  rto_code: ['rto_code', 'registration_rto'],
  inwarding_date: ['inwarding_date', 'inward_date', 'inwarding'],
  policy_issue_date: ['policy_issue_date', 'issue_date'],
  policy_valid_from: ['policy_valid_from', 'valid_from', 'start_date'],
  policy_valid_till: ['policy_valid_till', 'valid_till', 'expiry_date', 'policy_expiry_date', 'renewal_date', 'end_date'],
  od_end_date: ['od_end_date', 'od_expiry_date'],
  tp_end_date: ['tp_end_date', 'tp_expiry_date'],
  net_premium: ['net_premium', 'final_premium', 'premium'],
  total_premium_amount: ['total_premium_amount', 'gross_premium', 'total_premium'],
  status: ['status', 'renewal_status'],
  customer_response: ['customer_response', 'response', 'customer_status'],
  pending_with: ['pending_with', 'pending_side'],
  next_follow_up_date: ['next_follow_up_date', 'follow_up_date', 'next_call_date'],
  quoted_premium: ['quoted_premium'],
  renewed_premium: ['renewed_premium'],
  renewed_insurer: ['renewed_insurer'],
  renewed_on: ['renewed_on', 'renewal_done_date', 'renewed_date'],
  remarks: ['remarks', 'notes', 'comment'],
};

const STATUS_MAP = [
  ['renew', 'Renewed'],
  ['quote', 'Quoted'],
  ['follow', 'Follow-up'],
  ['reject', 'Rejected'],
  ['no response', 'No Response'],
  ['no_response', 'No Response'],
  ['pending', 'Pending'],
];

const RESPONSE_MAP = [
  ['renew', 'Renewed'],
  ['interest', 'Interested'],
  ['follow', 'Follow-up Needed'],
  ['reject', 'Rejected'],
  ['no response', 'No Response'],
  ['no_response', 'No Response'],
];

export function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['".]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toDateString(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const parsed = new Date(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function cleanValue(value) {
  if (value === undefined || value === null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function pick(record, field) {
  for (const candidate of FIELD_CANDIDATES[field] || []) {
    const value = record[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return cleanValue(value);
    }
  }
  return '';
}

function canonicalStatus(value) {
  const normalized = normalizeHeader(value);
  if (!normalized) return 'Pending';
  for (const [key, label] of STATUS_MAP) {
    if (normalized.includes(normalizeHeader(key))) return label;
  }
  return 'Pending';
}

function canonicalCustomerResponse(value, status) {
  if (status === 'Renewed') return 'Renewed';
  const normalized = normalizeHeader(value);
  if (!normalized) return 'No Response';
  for (const [key, label] of RESPONSE_MAP) {
    if (normalized.includes(normalizeHeader(key))) return label;
  }
  return 'No Response';
}

function likelyDataHeader(row) {
  const normalized = row.map(normalizeHeader).filter(Boolean);
  const hits = normalized.filter((value) => KEY_FIELD_HINTS.has(value)).length;
  const looksLikeSummary = normalized.includes('row_labels') || normalized.includes('column_labels') || normalized.includes('grand_total');
  return !looksLikeSummary && hits >= 3;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const row = rows[i] || [];
    if (likelyDataHeader(row)) return i;
  }
  return -1;
}

function normalizeRowObject(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );
}

function dedupeKeyFor(record) {
  const primary = record.policy_number || record.original_policy_number || record.vehicle_number;
  return [
    normalizeHeader(primary || 'unknown'),
    normalizeHeader(record.vehicle_number || 'unknown'),
    normalizeHeader(record.policy_valid_till || 'unknown'),
  ].join('__');
}

function mapRenewalRow(row, sheetName) {
  const policyNumber = pick(row, 'policy_number');
  const originalPolicyNumber = pick(row, 'original_policy_number');
  const vehicleNumber = pick(row, 'vehicle_number');
  const policyValidTill = toDateString(pick(row, 'policy_valid_till'));
  const primaryKey = policyNumber || originalPolicyNumber || vehicleNumber;

  if (!primaryKey || !policyValidTill) return null;

  const latestRm = pick(row, 'latest_rm');
  const sourceRm = pick(row, 'source_rm');
  const rmName = latestRm || sourceRm;
  const status = canonicalStatus(pick(row, 'status'));
  const customerResponse = canonicalCustomerResponse(pick(row, 'customer_response'), status);

  const mapped = {
    sheet_name: sheetName,
    policy_number: policyNumber,
    original_policy_number: originalPolicyNumber,
    policy_holder_name: pick(row, 'policy_holder_name'),
    policy_holder_phone: pick(row, 'policy_holder_phone'),
    policy_holder_email: pick(row, 'policy_holder_email'),
    insurer: pick(row, 'insurer'),
    broker_name: pick(row, 'broker_name'),
    broker_code: pick(row, 'broker_code'),
    rm_name: rmName,
    source_rm: sourceRm,
    latest_rm: latestRm,
    source_partner: pick(row, 'source_partner'),
    source_partner_code: pick(row, 'source_partner_code'),
    source_partner_type: pick(row, 'source_partner_type'),
    vehicle_number: vehicleNumber,
    vehicle_make: pick(row, 'vehicle_make'),
    vehicle_model: pick(row, 'vehicle_model'),
    vehicle_variant: pick(row, 'vehicle_variant'),
    year_of_manufacture: pick(row, 'year_of_manufacture'),
    policy_type: pick(row, 'policy_type'),
    vehicle_class: pick(row, 'vehicle_class'),
    vehicle_subclass: pick(row, 'vehicle_subclass'),
    subclass_name: pick(row, 'subclass_name'),
    vehicle_cc: pick(row, 'vehicle_cc'),
    vehicle_gvw: pick(row, 'vehicle_gvw'),
    pivot_points: pick(row, 'pivot_points'),
    seating_capacity: pick(row, 'seating_capacity'),
    fuel_type: pick(row, 'fuel_type'),
    rto_code: pick(row, 'rto_code'),
    inwarding_date: toDateString(pick(row, 'inwarding_date')),
    policy_issue_date: toDateString(pick(row, 'policy_issue_date')),
    policy_valid_from: toDateString(pick(row, 'policy_valid_from')),
    policy_valid_till: policyValidTill,
    od_end_date: toDateString(pick(row, 'od_end_date')),
    tp_end_date: toDateString(pick(row, 'tp_end_date')),
    net_premium: pick(row, 'net_premium'),
    total_premium_amount: pick(row, 'total_premium_amount'),
    status,
    customer_response: customerResponse,
    pending_with: pick(row, 'pending_with'),
    next_follow_up_date: toDateString(pick(row, 'next_follow_up_date')),
    quoted_premium: pick(row, 'quoted_premium'),
    renewed_premium: pick(row, 'renewed_premium'),
    renewed_insurer: pick(row, 'renewed_insurer'),
    renewed_on: toDateString(pick(row, 'renewed_on')),
    remarks: pick(row, 'remarks'),
    raw_data: row,
  };

  mapped.dedupe_key = dedupeKeyFor(mapped);
  return mapped;
}

export function parseRenewalWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rowMap = new Map();
  const sheetsUsed = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    const headerIndex = findHeaderRow(rawRows);
    if (headerIndex === -1) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      range: headerIndex,
      defval: '',
      raw: false,
      cellDates: true,
    });

    const sheetRows = rows
      .map(normalizeRowObject)
      .map((row) => mapRenewalRow(row, sheetName))
      .filter(Boolean);

    if (!sheetRows.length) continue;
    sheetsUsed.push(sheetName);
    for (const row of sheetRows) {
      const existing = rowMap.get(row.dedupe_key);
      if (!existing || (existing.sheet_name !== 'Master Sheet' && row.sheet_name === 'Master Sheet')) {
        rowMap.set(row.dedupe_key, row);
      }
    }
  }

  const mappedRows = [...rowMap.values()];

  if (!mappedRows.length) {
    throw new Error('No valid renewal rows found. Make sure at least one sheet has renewal policy data with expiry dates.');
  }

  return { rows: mappedRows, sheetsUsed };
}

export function renewalDays(policyValidTill) {
  if (!policyValidTill) return null;
  const end = new Date(`${policyValidTill}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
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

export function decorateRenewal(row) {
  const status = canonicalStatus(row.status);
  const customerResponse = canonicalCustomerResponse(row.customer_response, status);
  const days_to_renewal = renewalDays(row.policy_valid_till);
  const bucket = renewalBucket(days_to_renewal, status);
  return {
    ...row,
    status,
    customer_response: customerResponse,
    days_to_renewal,
    bucket,
    is_due_soon: status !== 'Renewed' && days_to_renewal !== null && days_to_renewal >= 0 && days_to_renewal <= 30,
    is_expired: status !== 'Renewed' && days_to_renewal !== null && days_to_renewal < 0,
  };
}
