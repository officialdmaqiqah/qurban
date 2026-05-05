import fs from 'fs';
import path from 'path';

const srcDir = 'e:\\Document Project Aplikasi\\Qurban\\src';
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

const emojis = ['☀️', '⚙️', '🔴', '🌙', '🔔', '⏻'];

files.forEach(file => {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    emojis.forEach(emoji => {
        if (content.includes(emoji)) {
            console.log(`Found ${emoji} in ${file}`);
        }
    });
});
