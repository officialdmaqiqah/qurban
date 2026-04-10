import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUsers() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email, role, status, allowed_menus, permissions');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log('--- USER PROFILES & PERMISSIONS ---');
    profiles.forEach(p => {
        console.log(`Email: ${p.email}`);
        console.log(`Role: ${p.role}`);
        console.log(`Status: ${p.status}`);
        console.log(`Allowed Menus: ${JSON.stringify(p.allowed_menus)}`);
        console.log(`Permissions: ${JSON.stringify(p.permissions)}`);
        console.log('-----------------------------------');
    });
}

checkUsers();
