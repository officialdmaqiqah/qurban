import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBana() {
  console.log('Searching for matches to "Bana"...');
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or('full_name.ilike.%bana%,email.ilike.%bana%');

  if (error) {
    console.error('Error fetching profile:', error);
    return;
  }

  if (data.length === 0) {
    console.log('No profile found for "Bana".');
  } else {
    data.forEach(p => {
        console.log(`- Nama: ${p.full_name}`);
        console.log(`  Email: ${p.email}`);
        console.log(`  Role: ${p.role}`);
        console.log(`  Status: ${p.status}`);
        console.log(`  ID: ${p.id}`);
        console.log('-------------------');
    });
  }
}

checkBana();
