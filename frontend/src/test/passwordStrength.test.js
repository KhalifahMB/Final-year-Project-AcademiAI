import { describe, it, expect } from 'vitest';
import { passwordStrength } from '@/lib/passwordStrength';

// The signup form only enforced z.string().min(8), so 'aaaaaaaa' and
// 'Tr0ub4dor&3x' looked identical to the user. The meter must agree with that
// schema: 8 characters is accepted, it is just not a strong password.
describe('passwordStrength', () => {
  it('is silent for an empty field', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '', color: null });
  });

  it('never scores above weak while under the 8-character minimum', () => {
    expect(passwordStrength('Ab1!').score).toBe(1);
    expect(passwordStrength('Ab1!').label).toBe('Weak');
  });

  it('scores by character classes once the minimum length is met', () => {
    expect(passwordStrength('abcdefgh')).toMatchObject({ score: 1, label: 'Weak' });
    expect(passwordStrength('abcdefg1')).toMatchObject({ score: 2, label: 'Fair' });
    expect(passwordStrength('Abcdefg1')).toMatchObject({ score: 3, label: 'Good' });
  });

  it('requires length as well as variety for the top band', () => {
    expect(passwordStrength('Abcdefg1!').label).toBe('Good');
    expect(passwordStrength('Abcdefghij1!')).toMatchObject({ score: 4, label: 'Strong' });
  });

  it('maps each band to a semantic token colour', () => {
    expect(passwordStrength('abcdefgh').color).toBe('var(--danger)');
    expect(passwordStrength('abcdefg1').color).toBe('var(--warn)');
    expect(passwordStrength('Abcdefg1').color).toBe('var(--info)');
    expect(passwordStrength('Abcdefghij1!').color).toBe('var(--success)');
  });
});
