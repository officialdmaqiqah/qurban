import fs from 'fs';
import path from 'path';

const directory = 'e:\\Document Project Aplikasi\\Qurban';

const replacements = [
    {
        file: 'kambing.html',
        pattern: /<th[^>]*data-column="no_tali">No Tali [^<]*<\/th>\s*<th[^>]*data-column="warna_tali">Warna [^<]*<\/th>/g,
        replacement: '<th style="cursor:pointer;" class="sort-header sticky-col" data-column="no_tali">Tali / Warna ↕️</th>'
    },
    {
        file: 'kambing_masuk.html',
        pattern: /<th[^>]*data-column="no_tali">No Tali [^<]*<\/th>\s*<th[^>]*data-column="warna_tali">Warna [^<]*<\/th>/g,
        replacement: '<th style="cursor:pointer;" class="sort-header sticky-col" data-column="no_tali">Tali / Warna ↕️</th>'
    },
    {
        file: 'kambing_mati.html',
        pattern: /<th[^>]*data-column="no_tali">No Tali [^<]*<\/th>\s*<th[^>]*data-column="warna_tali">Warna [^<]*<\/th>/g,
        replacement: '<th style="cursor:pointer;" class="sort-header sticky-col" data-column="no_tali">Tali / Warna ↕️</th>'
    },
    {
        file: 'kambing_sakit.html',
        pattern: /<th[^>]*data-column="no_tali">No Tali [^<]*<\/th>\s*<th[^>]*data-column="warna_tali">Warna [^<]*<\/th>/g,
        replacement: '<th style="cursor:pointer;" class="sort-header sticky-col" data-column="no_tali">Tali / Warna ↕️</th>'
    },
    {
        file: 'kambing_terjual.html',
        pattern: /<th[^>]*data-column="no_tali">No Tali [^<]*<\/th>\s*<th[^>]*data-column="warna_tali">Warna [^<]*<\/th>/g,
        replacement: '<th style="cursor:pointer;" class="sort-header sticky-col" data-column="no_tali">Tali / Warna ↕️</th>'
    }
];

replacements.forEach(r => {
    const filePath = path.join(directory, r.file);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (r.pattern.test(content)) {
        console.log(`Updating ${r.file} headers...`);
        const newContent = content.replace(r.pattern, r.replacement);
        fs.writeFileSync(filePath, newContent, 'utf8');
    } else {
        console.log(`Pattern not found in ${r.file}`);
    }
});
