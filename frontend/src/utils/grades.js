export const GRADES = {
  9:  'ثالث إعدادي',
  10: 'أول ثانوي',
  11: 'ثاني ثانوي',
};

export const GRADE_LIST = Object.entries(GRADES).map(([value, label]) => ({
  value: Number(value), label
}));

export const gradeLabel = (g) => GRADES[g] || '—';
