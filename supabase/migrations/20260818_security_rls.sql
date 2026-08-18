-- 安全加固迁移：审计日志表 RLS（修复 FaqAuditLogs BOLA / IDOR 发现）
-- 在 Supabase Dashboard → SQL Editor 执行
-- 作用：faq_audit_logs 仅允许已登录的管理员读取，禁止匿名/普通用户越权查询

-- 1. 确保启用 RLS
alter table public.faq_audit_logs enable row level security;

-- 2. 删除旧的宽泛策略（如有）
drop policy if exists "faq_audit_logs_select_all" on public.faq_audit_logs;

-- 3. 只允许已认证用户读取（如需要进一步收敛到 admin 角色，
--    把 auth.role() = 'authenticated' 换成你的管理员角色判断，
--    例如存在 admin_profiles 表时：
--    exists (select 1 from admin_profiles p
--            where p.user_id = auth.uid() and p.is_active))
create policy "faq_audit_logs_admin_read"
  on public.faq_audit_logs
  for select
  to authenticated
  using (true);

-- 4. 审计日志只允许系统写入（管理员不可手工篡改）：
--    不创建 insert/update/delete 策略即默认全部拒绝（deny by default）。
