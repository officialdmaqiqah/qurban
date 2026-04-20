import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

(async () => {
    const {data, error} = await supabase.from('keuangan').select('*').eq('nominal', 2500000);
    if(error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(data, null, 2));
})();
