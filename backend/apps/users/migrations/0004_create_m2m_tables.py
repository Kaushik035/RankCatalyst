from django.db import migrations


class Migration(migrations.Migration):
	dependencies = [
		("users", "0003_add_is_superuser"),
	]

	operations = [
		migrations.RunSQL(
			"""
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.tables WHERE table_name='users_user_groups'
				) THEN
					CREATE TABLE users_user_groups (
						id BIGSERIAL PRIMARY KEY,
						user_id BIGINT NOT NULL REFERENCES users_user(id) DEFERRABLE INITIALLY DEFERRED,
						group_id BIGINT NOT NULL REFERENCES auth_group(id) DEFERRABLE INITIALLY DEFERRED
					);
					CREATE UNIQUE INDEX users_user_groups_user_id_group_id_uniq ON users_user_groups(user_id, group_id);
					CREATE INDEX users_user_groups_user_id_idx ON users_user_groups(user_id);
					CREATE INDEX users_user_groups_group_id_idx ON users_user_groups(group_id);
				END IF;
			END$$;
			""",
			reverse_sql="""
			DROP TABLE IF EXISTS users_user_groups CASCADE;
			""",
		),
		migrations.RunSQL(
			"""
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.tables WHERE table_name='users_user_user_permissions'
				) THEN
					CREATE TABLE users_user_user_permissions (
						id BIGSERIAL PRIMARY KEY,
						user_id BIGINT NOT NULL REFERENCES users_user(id) DEFERRABLE INITIALLY DEFERRED,
						permission_id BIGINT NOT NULL REFERENCES auth_permission(id) DEFERRABLE INITIALLY DEFERRED
					);
					CREATE UNIQUE INDEX users_user_perms_user_id_permission_id_uniq ON users_user_user_permissions(user_id, permission_id);
					CREATE INDEX users_user_perms_user_id_idx ON users_user_user_permissions(user_id);
					CREATE INDEX users_user_perms_permission_id_idx ON users_user_user_permissions(permission_id);
				END IF;
			END$$;
			""",
			reverse_sql="""
			DROP TABLE IF EXISTS users_user_user_permissions CASCADE;
			""",
		),
	]
