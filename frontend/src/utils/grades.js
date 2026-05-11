export const GRADES = {
  9:  'ثالث إعدادي',
  10: 'أول ثانوي',
  11: 'ثاني ثانوي',
  12: 'ثالث ثانوي',
};

export const GRADE_LIST = Object.entries(GRADES).map(([value, label]) => ({
  value: Number(value), label
}));

export const gradeLabel = (g) => GRADES[g] || '—';

export const GradeOptions = () =>
  GRADE_LIST.map(g => (
    <option key={g.value} value={g.value}>{g.label}</option>
  ));
