import pkg from '../src/supabase.js';
const { supabase } = pkg;

async function checkYahya() {
    const { data, error } = await supabase
        .from('profiles')
        .select('email, role')
        .ilike('email', '%yahya%');

    if (error) {
        console.log('Error fetching profile:', error);
    } else {
        console.log('Yahya Profile:', data);
    }
}

checkYahya();
