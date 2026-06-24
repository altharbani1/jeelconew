-- السماح للمستخدم فقط بجلب صفه
CREATE POLICY "Allow user to select own row" ON app_users
  FOR SELECT USING (id = auth.uid());

-- السماح للمستخدم فقط بإضافة صفه
CREATE POLICY "Allow user to insert own row" ON app_users
  FOR INSERT WITH CHECK (id = auth.uid());

-- السماح للمستخدم فقط بتحديث صفه
CREATE POLICY "Allow user to update own row" ON app_users
  FOR UPDATE USING (id = auth.uid());
