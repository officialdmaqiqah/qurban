import { supabase } from '../src/supabase.js';

async function checkBana() {
    const { data, error } = await supabase.from('profiles')
        .select('*')
        .or('email.eq.Bana123,email.eq.Bana123@qurban.com');
    
    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }
    
    console.log('Results for Bana123:');
    console.log(JSON.stringify(data, null, 2));
}

checkBana();
