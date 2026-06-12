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

    // Convert server UTC time to local time by appending 'Z'
    // Do not append 'Z' to date-only values to prevent them from shifting backwards in negative timezones
    if (!isDateOnly && parseStr.includes('T') && !parseStr.endsWith('Z') && !parseStr.includes('+')) {
      parseStr += 'Z';
    }

    const d = new Date(parseStr);
    if (isNaN(d.getTime())) return dateString;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (isDateOnly || (!str.includes(' ') && !str.includes('T') && !str.includes(':'))) {
      return `${day}/${month}/${year}`;
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
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
