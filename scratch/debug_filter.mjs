import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testFilter() {
    const { data: goats, error } = await supabase.from('stok_kambing').select('*');
    if (error) {
        console.error("Error fetching goats:", error);
        return;
    }

    console.log(`Total goats in DB: ${goats.length}`);

    // Simulate window.parseNum
    function parseNum(val) {
        if(!val) return 0;
        if(typeof val === 'number') return val;
        return parseInt(val.toString().replace(/\./g, '')) || 0;
    }

    // Initial state in kambing.js
    const inpMinHarga_value = "";
    const inpMaxHarga_value = "";
    const inpSearch_value = "";

    const minHarga = parseNum(inpMinHarga_value);
    const maxHarga = parseNum(inpMaxHarga_value) || Infinity;
    const search = inpSearch_value.toLowerCase();

    console.log(`Initial Filters -> minHarga: ${minHarga}, maxHarga: ${maxHarga}, search: "${search}"`);

    let filtered = [...goats];
    
    if(search) {
        filtered = filtered.filter(k => 
            (k.no_tali || '').toLowerCase().includes(search) ||
            (k.id || '').toLowerCase().includes(search) ||
            (k.supplier || '').toLowerCase().includes(search) ||
            (k.batch || '').toLowerCase().includes(search) ||
            (k.warna_tali || '').toLowerCase().includes(search) ||
            (k.sex || '').toLowerCase().includes(search) ||
            (k.lokasi || '').toLowerCase().includes(search)
        );
    }
    
    if(minHarga > 0) {
        console.log("Applying minHarga filter");
        filtered = filtered.filter(k => k.harga_kandang >= minHarga);
    }
    
    if(maxHarga < Infinity && maxHarga > 0) {
        console.log("Applying maxHarga filter");
        filtered = filtered.filter(k => k.harga_kandang <= maxHarga);
    }

    console.log(`Filtered goats count: ${filtered.length}`);
    if (filtered.length === 0 && goats.length > 0) {
        console.log("WARNING: All data was filtered out!");
        console.log("Samples of harga_kandang:", goats.slice(0, 5).map(g => g.harga_kandang));
    }
}

testFilter();
