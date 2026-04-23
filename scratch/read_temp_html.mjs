import fs from 'fs';
const content = fs.readFileSync('temp_html.txt', 'utf16le');
console.log(content.substring(0, 1000));
