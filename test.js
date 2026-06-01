const parseDate = (dStr) => {
  if (!dStr) return 0;
  let str = String(dStr).trim();
  
  if (str.includes('-') && str.split('-')[0].length <= 2) {
    const parts = str.split(/[\sT]+/);
    const [day, month, year] = parts[0].split('-');
    str = `${year}-${month}-${day}${parts[1] ? ' ' + parts[1] : ''}`;
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str += ' 00:00:00';
  }
  
  if (!str.includes('T') && !str.includes('Z')) {
      str = str.replace(/-/g, '/');
  }

  const time = new Date(str).getTime();
  return isNaN(time) ? 0 : time;
};

console.log('Test 1 (01-06-2026):', parseDate('01-06-2026'));
console.log('Test 2 (01-06-2026 10:30):', parseDate('01-06-2026 10:30'));
console.log('Test 3 (2026-06-01):', parseDate('2026-06-01'));
console.log('Test 4 (2026-06-01 10:30):', parseDate('2026-06-01 10:30'));
console.log('Test 5 (2026-06-01T10:30:00Z):', parseDate('2026-06-01T10:30:00Z'));
console.log('Test 6 (Empty):', parseDate(''));
