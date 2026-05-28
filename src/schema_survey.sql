-- ==========================================================
-- DDL untuk Tabel Survey Kepuasan Pelayanan Kurban
-- Daarul Mahabbah Qurban 2026
-- ==========================================================

-- 1. Membuat Tabel Survey
CREATE TABLE IF NOT EXISTS public.survey_kepuasan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tgl_survey TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tipe_responden TEXT NOT NULL CHECK (tipe_responden IN ('Sohibul Qurban', 'Agen')),
    nama TEXT DEFAULT 'Hamba Allah',
    alamat TEXT DEFAULT '',
    rating_aspek JSONB NOT NULL, -- Menyimpan rating per aspek, misal: {"Pelayanan": 5, "Hewan": 4}
    rating_rata NUMERIC(3,2) NOT NULL, -- Rata-rata rating untuk kemudahan sorting/filtering
    catatan TEXT, -- Ulasan essay tertulis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Mengaktifkan Row Level Security (RLS)
ALTER TABLE public.survey_kepuasan ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan Keamanan (Security Policies)
-- Hapus kebijakan jika sudah ada sebelumnya agar tidak terjadi error duplikat
DROP POLICY IF EXISTS "Allow public insert survey" ON public.survey_kepuasan;
DROP POLICY IF EXISTS "Allow authenticated admins select survey" ON public.survey_kepuasan;

-- Kebijakan A: Izinkan siapa saja (publik) untuk mengirimkan survey (Insert)
CREATE POLICY "Allow public insert survey" ON public.survey_kepuasan
    FOR INSERT WITH CHECK (true);

-- Kebijakan B: Hanya izinkan user dengan role admin/staff/office/operator atau yang memiliki izin "hasil_survey.html" di allowed_menus untuk melihat hasil survey (Select)
CREATE POLICY "Allow authenticated admins select survey" ON public.survey_kepuasan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('admin', 'office', 'staf', 'operator') 
                OR profiles.allowed_menus @> '["hasil_survey.html"]'::jsonb
            )
        )
    );

-- 4. Aktifkan Fitur Realtime (Opsional)
-- Menggunakan blok DO untuk mencegah eror jika tabel sudah terdaftar dalam publikasi
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_kepuasan;
EXCEPTION
    WHEN OTHERS THEN
        -- Abaikan jika sudah terdaftar
        NULL;
END $$;
