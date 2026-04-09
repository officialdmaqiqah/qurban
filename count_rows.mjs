import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase.from('transaksi').select('count', { count: 'exact' });
console.log('Transaksi count:', data, error);
const { data: mData, error: mError } = await supabase.from('master_data').select('count', { count: 'exact' });
console.log('Master Data count:', mData, mError);
