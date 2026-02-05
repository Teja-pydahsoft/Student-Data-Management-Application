-- Allow custom role values in rbac_users (role config can define any role_key)
ALTER TABLE rbac_users MODIFY COLUMN role VARCHAR(64) NOT NULL;
