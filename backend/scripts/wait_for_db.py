import os
import time

import psycopg2

DB_NAME = os.getenv("POSTGRES_DB", "rankcatalyst")
DB_USER = os.getenv("POSTGRES_USER", "rank_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "rank_pass")
DB_HOST = os.getenv("POSTGRES_HOST", "db")
DB_PORT = int(os.getenv("POSTGRES_PORT", 5432))


def wait_for_db():
	while True:
		try:
			conn = psycopg2.connect(dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT)
			conn.close()
			print("Database is ready.")
			break
		except psycopg2.OperationalError:
			print("Waiting for database...")
			time.sleep(1)


if __name__ == "__main__":
	wait_for_db()
