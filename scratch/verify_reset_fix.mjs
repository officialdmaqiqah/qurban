import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyResetFix() {
    const username = 'Bana123';
    const newPwd = 'BanaNewPassword123';
    
    console.log(`Simulating reset request for ${username}...`);
    
    // 1. Find user
    const targetEmail = 'Bana123@qurban.com';
    const { data: profiles, error: findErr } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.eq.${username},email.eq.${targetEmail}`);
    
    if (findErr) {
        console.error('Find User Error:', findErr);
        return;
    }
    
    const found = profiles?.[0];
    if (!found) {
        console.error('User not found in DB!');
        return;
    }
    
    console.log(`User found: ${found.full_name} (${found.email})`);
    
    // 2. Insert request (simulating step 2)
    const { error: insErr } = await supabase.from('edit_requests').insert([{
        trx_id: 'RESET-TEST-' + found.id.substring(0,4),
        new_data: { 
            type: 'PASSWORD_RESET_REQUEST', 
            email: found.email, 
            full_name: found.full_name,
            new_password: newPwd,
            tgl: new Date().toISOString() 
        },
        requester_email: found.email,
        status: 'pending'
    }]);
    
    if (insErr) {
        console.error('Insert Request Error:', insErr);
        return;
    }
    
    console.log('✅ Request inserted successfully!');
    
    // 3. Verify it's there
    const { data: verifData } = await supabase.from('edit_requests')
        .select('*')
        .eq('requester_email', found.email)
        .eq('status', 'pending')
        .order('timestamp', { ascending: false })
        .limit(1);
    
    if (verifData?.[0]?.new_data?.new_password === newPwd) {
        console.log('✅ VERIFICATION SUCCESS: Database contains the new password in the request.');
    } else {
        console.log('❌ VERIFICATION FAILED: Data mismatch.');
        console.log(JSON.stringify(verifData, null, 2));
    }
}

verifyResetFix();
