-- 1. Tabel Stok Kambing (Inventory)
CREATE TABLE IF NOT EXISTS stok_kambing (
    id TEXT PRIMARY KEY,
    batch TEXT NOT NULL,
    tgl_masuk DATE,
    supplier TEXT,
    no_tali TEXT NOT NULL,
    warna_tali TEXT,
    sex TEXT,
    lokasi TEXT,
    berat NUMERIC(10,2),
    harga_nota NUMERIC(15,2) DEFAULT 0,
    saving NUMERIC(15,2) DEFAULT 0,
    profit NUMERIC(15,2) DEFAULT 0,
    harga_kandang NUMERIC(15,2) DEFAULT 0,
    status_transaksi TEXT DEFAULT 'Tersedia',
    status_kesehatan TEXT DEFAULT 'Sehat',
    status_fisik TEXT DEFAULT 'Ada',
    foto_fisik TEXT,
    foto_thumb TEXT,
    foto_nota_url TEXT,
    transaction_id TEXT,
    status_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Transaksi Penjualan
CREATE TABLE IF NOT EXISTS transaksi (
    id TEXT PRIMARY KEY,
    tgl_trx DATE DEFAULT CURRENT_DATE,
    customer JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    delivery JSONB DEFAULT '{}'::jsonb,
    total_deal NUMERIC(15,2) DEFAULT 0,
    total_paid NUMERIC(15,2) DEFAULT 0,
    total_overpaid NUMERIC(15,2) DEFAULT 0,
    history_bayar JSONB DEFAULT '[]'::jsonb,
    komisi JSONB DEFAULT '{}'::jsonb,
    agen JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Pencatatan Keuangan (Arus Kas)
CREATE TABLE IF NOT EXISTS keuangan (
    id TEXT PRIMARY KEY,
    tanggal DATE DEFAULT CURRENT_DATE,
    tipe TEXT CHECK (tipe IN ('pemasukan', 'pengeluaran')),
    kategori TEXT,
    nominal NUMERIC(15,2) DEFAULT 0,
    keterangan TEXT,
    channel TEXT,
    rek_id TEXT,
    bukti_url TEXT,
    related_trx_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Master Data (Supportings)
CREATE TABLE IF NOT EXISTS master_data (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL, -- Contoh: 'SUPPLIERS', 'AGEN', 'LOKASI', 'REKENING', 'WA_CONFIG'
    val JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel User Profiles (Integrated with Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'staff', -- admin, staff, agen, sopir
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    jenis_agen TEXT, -- Jenis agen jika role=agen
    allowed_menus JSONB DEFAULT '[]'::jsonb,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabel Permohonan Edit Data (Dari Agen ke Admin)
CREATE TABLE IF NOT EXISTS edit_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    requester_id TEXT,
    trx_id TEXT,
    agen_name TEXT,
    requester_email TEXT,
    old_data JSONB,
    new_data JSONB,
    status TEXT DEFAULT 'pending', -- pending, done, rejected
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE stok_kambing;
ALTER PUBLICATION supabase_realtime ADD TABLE transaksi;
ALTER PUBLICATION supabase_realtime ADD TABLE keuangan;
ALTER PUBLICATION supabase_realtime ADD TABLE master_data;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE edit_requests;
