import fs from 'fs';
import path from 'path';

const directory = 'e:\\Document Project Aplikasi\\Qurban';

// This regex is now more flexible: handles noTali/no_tali and different class/styles
const pattern = /<th[^>]*data-column="(?:noTali|no_tali)"[^>]*>No Tali [^<]*<\/th>\s*<th[^>]*data-column="(?:warnaTali|warna_tali)"[^>]*>Warna [^<]*<\/th>/gi;

const files = fs.readdirSync(directory).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(directory, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (pattern.test(content)) {
        console.log(`Updating ${file} headers...`);
        // We preserve the existing data-column of the first cell (noTali or no_tali)
        const newContent = content.replace(pattern, (match) => {
            const dataColumnMatch = match.match(/data-column="([^"]+)"/i);
            const dataColumn = dataColumnMatch ? dataColumnMatch[1] : 'no_tali';
            return `<th style="cursor:pointer;" class="sort-header sticky-col" data-column="${dataColumn}">Tali / Warna ↕️</th>`;
        });
        fs.writeFileSync(filePath, newContent, 'utf8');
    } else {
        // console.log(`Pattern not found in ${file}`);
    }
});
console.log('HTML Headers Update Done!');
