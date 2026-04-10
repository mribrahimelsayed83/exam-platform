export const GRADES = {
  4:  'رابع ابتدائي',
  5:  'خامس ابتدائي',
  6:  'سادس ابتدائي',
  7:  'أول إعدادي',
  8:  'ثاني إعدادي',
  9:  'ثالث إعدادي',
  10: 'أول ثانوي',
  11: 'ثاني ثانوي',
};

export const GRADE_LIST = Object.entries(GRADES).map(([value, label]) => ({
  value: Number(value), label
}));

export const gradeLabel = (g) => GRADES[g] || '—';

export const GradeOptions = () =>
  GRADE_LIST.map(g => (
    <option key={g.value} value={g.value}>{g.label}</option>
  ));
