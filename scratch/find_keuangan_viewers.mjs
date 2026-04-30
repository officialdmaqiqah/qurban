import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
// I will just use the anonymous key from the file, wait I need to see the file to copy the key.
// I'll grab it from check_profiles.mjs
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }
    
    const canViewDashboard = data.filter(p => {
        const role = (p.role || 'staff').toLowerCase().trim();
        const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(role);
        const allowedMenus = p.allowed_menus || [];
        return isAdmin || allowedMenus.includes('dashboard.html');
    });

    console.log('Total akun yang bisa melihat Dashboard Keuangan:', canViewDashboard.length);
    canViewDashboard.forEach(p => {
        console.log('- Nama:', p.name, '| Role:', p.role, '| Allowed Menus:', p.allowed_menus);
    });
}

checkProfiles();
