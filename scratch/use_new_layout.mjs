import fs from 'fs';
import path from 'path';

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace layout.js with layout_v51.js
    const newContent = content.replace(/src\/layout\.js(\?v=[\d\.]+)?/g, 'src/layout_v51.js');
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file} to use layout_v51.js`);
    }
});
