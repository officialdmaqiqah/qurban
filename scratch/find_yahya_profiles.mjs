import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findYahya() {
    console.log('Listing all profiles containing "Yahya"...');
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error(error);
        return;
    }

    const matched = data.filter(p => (p.full_name || '').toLowerCase().includes('yahya'));
    console.log(`Found ${matched.length} matches:`);
    console.table(matched.map(p => ({
        ID: p.id,
        Name: p.full_name,
        Email: p.email,
        Role: p.role
    })));
}

findYahya();
