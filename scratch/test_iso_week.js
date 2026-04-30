const getIsoWeek = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return d.getFullYear() + '-W' + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7 + 1).toString().padStart(2, '0');
};

console.log(getIsoWeek('2024-01-01'));
console.log(getIsoWeek('2026-04-28'));
