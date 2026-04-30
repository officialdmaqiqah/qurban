import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking profiles for Rozi...');
    const { data: profs } = await supabase.from('profiles').select('*');
    const matches = profs.filter(p => (p.full_name || '').toLowerCase().includes('rozi'));
    console.log('Matches:', matches.map(p => ({ id: p.id, name: p.full_name, role: p.role })));
    
    console.log('Total profiles found:', profs.length);
}

check();
