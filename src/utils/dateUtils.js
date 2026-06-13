export const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  try {
    const str = String(dateString).trim();
    // Support DD-MM-YYYY HH:mm:ss format that might come from the server
    let parseStr = str;
    if (str.includes('-') && str.split('-')[0].length <= 2) {
      const parts = str.split(/[\sT]+/);
      const [day, month, year] = parts[0].split('-');
      parseStr = `${year}-${month}-${day}${parts[1] ? 'T' + parts[1] : ''}`;
    }

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(parseStr);
    if (isDateOnly) {
      parseStr = `${parseStr}T00:00:00`;
    }

    // Fix for older safari or strictly standard environments replacing space with T
    if (parseStr.includes(' ') && !parseStr.includes('T')) {
      parseStr = parseStr.replace(' ', 'T');
    }

    // The server is already returning India Time (IST) but without timezone info.
    // We append '+05:30' instead of 'Z' so it parses as IST explicitly.
    if (!isDateOnly && parseStr.includes('T') && !parseStr.endsWith('Z') && !parseStr.includes('+')) {
      parseStr += '+05:30';
    }

    const d = new Date(parseStr);
    if (isNaN(d.getTime())) return dateString;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (isDateOnly || (!str.includes(' ') && !str.includes('T') && !str.includes(':'))) {
      return `${day}/${month}/${year}`;
    }

    // Convert to India Time (IST)
    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(d);
    
    let istDay, istMonth, istYear, istHour, istMinute, istAmpm;
    parts.forEach(p => {
      if (p.type === 'day') istDay = p.value;
      if (p.type === 'month') istMonth = p.value;
      if (p.type === 'year') istYear = p.value;
      if (p.type === 'hour') istHour = p.value;
      if (p.type === 'minute') istMinute = p.value;
      if (p.type === 'dayPeriod') istAmpm = p.value.toUpperCase();
    });

    return `${istDay}/${istMonth}/${istYear} ${istHour}:${istMinute} ${istAmpm}`;
  } catch {
    return dateString;
  }
};
export const getLocalISODate = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
