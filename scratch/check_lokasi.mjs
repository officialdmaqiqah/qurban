import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase.from('master_data').select('*').eq('key', 'LOKASI').single();
console.log(JSON.stringify(data, null, 2));
