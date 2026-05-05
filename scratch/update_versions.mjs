import fs from 'fs';
import path from 'path';

const rootDir = 'e:\\Document Project Aplikasi\\Qurban';

function updateHtmlFiles() {
    const files = fs.readdirSync(rootDir);
    files.forEach(file => {
        if (file.endsWith('.html')) {
            const filePath = path.join(rootDir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Update v5.4 and v5.0 and other potential versions to v5.5
            const updatedContent = content.replace(/\.js\?v=[\d\.]+/g, '.js?v=5.5');
            
            if (content !== updatedContent) {
                fs.writeFileSync(filePath, updatedContent);
                console.log(`Updated ${file}`);
            }
        }
    });
}

updateHtmlFiles();
