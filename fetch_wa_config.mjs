import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase
    .from('master_data')
    .select('*')
    .eq('key', 'WA_CONFIG')
    .single();

console.log(JSON.stringify({ data, error }, null, 2));
