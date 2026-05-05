import fs from 'fs';
import path from 'path';

function cleanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            cleanDir(filePath);
        } else if (file.endsWith('.html')) {
            let content = fs.readFileSync(filePath, 'utf8');
            const pattern = /<div class="topbar-actions"[\s\S]*?<\/div>/g;
            if (pattern.test(content)) {
                console.log(`Cleaning ${filePath}...`);
                content = content.replace(pattern, '');
                fs.writeFileSync(filePath, content);
            }
        }
    });
}

cleanDir('e:\\Document Project Aplikasi\\Qurban');
