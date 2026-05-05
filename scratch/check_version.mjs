import { supabase } from '../src/supabase.js';

async function checkVersion() {
    try {
        const { data, error } = await supabase.from('master_data').select('*').eq('key', 'VERSION').maybeSingle();
        if (data) {
            console.log('VERSION DATA:', JSON.stringify(data.val));
        } else if (error) {
            console.error('ERROR:', error);
        } else {
            console.log('No VERSION key found in master_data');
        }
    } catch (e) {
        console.error('CATCH:', e);
    }
}

checkVersion();
