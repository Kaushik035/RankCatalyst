from django.core import signing
from django.utils import timezone

DEFAULT_MAX_AGE = 60 * 60 * 24  # 24 hours


def generate_token(payload: dict, salt: str) -> str:
	return signing.dumps(payload, salt=salt)


def verify_token(token: str, salt: str, max_age: int = DEFAULT_MAX_AGE) -> dict | None:
	try:
		data = signing.loads(token, salt=salt, max_age=max_age)
		return data
	except signing.BadSignature:
		return None
	except signing.SignatureExpired:
		return None


def now_ts() -> int:
	return int(timezone.now().timestamp())
