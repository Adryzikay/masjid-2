-- =====================================================================
-- Beri kebenaran admin kepada satu akaun.
--
-- 1. Cipta akaun dahulu: Supabase > Authentication > Users > Add user >
--    Create new user (tandakan "Auto Confirm User").
-- 2. Tukar emel dan nama di bawah, kemudian Run dalam SQL Editor.
-- =====================================================================
insert into public.admins (user_id, nama)
select id, 'adry'
from auth.users
where email = 'adry.zikayy@gmail.com'
on conflict (user_id) do update set nama = excluded.nama;

-- Semak siapa admin sekarang:
-- select a.nama, u.email, a.dicipta_pada
-- from public.admins a join auth.users u on u.id = a.user_id;

-- Tarik balik kebenaran (akaun kekal wujud tetapi tidak boleh mengubah apa-apa):
-- delete from public.admins
-- where user_id = (select id from auth.users where email = 'emel.admin@contoh.com');
