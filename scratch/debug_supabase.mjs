import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function debug() {
        console.log('--- Supabase Debug ---');
        console.log('URL:', urlMatch[1]);
        
        // Try fetching with error logging
        const { data, error, status, statusText } = await supabase.from('stok_kambing').select('*').limit(1);
        
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Status:', status, statusText);
            console.log('Data sample:', data);
        }
        
        // Check if we can see ANY profile
        const { data: pData, error: pError } = await supabase.from('profiles').select('full_name').limit(1);
        console.log('Profile test:', pData || pError);
    }
    
    debug();
}
