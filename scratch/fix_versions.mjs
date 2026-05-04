import fs from 'fs';
import path from 'path';

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update layout.js version to v4.3
    const newContent = content
        .replace(/layout\.js\?v=4\.0/g, 'layout.js?v=4.3')
        .replace(/layout\.js\?v=4\.1/g, 'layout.js?v=4.3')
        .replace(/layout\.js\?v=4\.2/g, 'layout.js?v=4.3');
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file}`);
    }
});
