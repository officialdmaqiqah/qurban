import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const menuHtml = '                <a href="deposit_agen.html" class="nav-item">&bull; Titipan Dana Agen</a>';

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Skip if already exists
    if (content.includes('href="deposit_agen.html"')) {
        console.log(`[SKIP] ${file} already has the menu.`);
        return;
    }

    // Look for keuangan order to inject after
    // Pattern: <a href="keuangan.html" class="nav-item">&bull; Pencatatan Keuangan</a>
    const pattern = /<a href="keuangan\.html"[^>]*>.*?<\/a>/;
    const match = content.match(pattern);

    if (match) {
        console.log(`[UPDATE] Injecting menu into ${file}`);
        const newContent = content.replace(match[0], match[0] + '\n' + menuHtml);
        fs.writeFileSync(file, newContent, 'utf8');
    } else {
        console.log(`[WARN] ${file} has no keuangan.html link, skipping.`);
    }
});
