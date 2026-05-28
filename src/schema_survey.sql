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
-- Kebijakan A: Izinkan siapa saja (publik) untuk mengirimkan survey (Insert)
CREATE POLICY "Allow public insert survey" ON public.survey_kepuasan
    FOR INSERT WITH CHECK (true);

-- Kebijakan B: Hanya izinkan user dengan role admin/staff/office/operator atau akun tertentu (termasuk Husni dan Wawan) untuk melihat hasil survey (Select)
CREATE POLICY "Allow authenticated admins select survey" ON public.survey_kepuasan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('admin', 'office', 'staf', 'operator') 
                OR LOWER(profiles.email) IN ('husnidm', 'wse82', 'husnimm@gmail.com', 'yahya@example.com')
                OR profiles.id IN ('9327abcb-7328-494e-be55-d6ad773e452c', '30348fa8-b8f3-4503-a2f7-b87191633738')
            )
        )
    );

-- 4. Aktifkan Fitur Realtime (Opsional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_kepuasan;
