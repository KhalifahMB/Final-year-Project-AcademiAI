const BANDS = [
  { label: '', color: null },
  { label: 'Weak', color: 'var(--danger)' },
  { label: 'Fair', color: 'var(--warn)' },
  { label: 'Good', color: 'var(--info)' },
  { label: 'Strong', color: 'var(--success)' },
];

const MIN_LENGTH = 8;
const LONG_LENGTH = 12;

const classCount = (value) =>
  [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;

// Deliberately mirrors signupSchema's min(8): short passwords are always weak,
// and the top band needs variety AND length, so 'Abcdefg1!' reads as Good and
// not Strong.
export function passwordStrength(value) {
  if (!value) return { score: 0, ...BANDS[0] };
  if (value.length < MIN_LENGTH) return { score: 1, ...BANDS[1] };
  const score =
    value.length < LONG_LENGTH ? Math.min(classCount(value), 3) : classCount(value);
  return { score, ...BANDS[score] };
}
