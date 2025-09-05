from django.db import migrations


class Migration(migrations.Migration):
	dependencies = [
		("users", "0002_alter_user_managers_alter_user_groups_and_more"),
	]

	operations = [
		migrations.RunSQL(
			"""
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name='users_user' AND column_name='is_superuser'
				) THEN
					ALTER TABLE users_user ADD COLUMN is_superuser boolean NOT NULL DEFAULT false;
				END IF;
			END$$;
			""",
			reverse_sql="""
			ALTER TABLE users_user DROP COLUMN IF EXISTS is_superuser;
			""",
		),
	]
