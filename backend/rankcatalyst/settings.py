# Import the appropriate settings based on environment
import os

# Default to development settings
DJANGO_SETTINGS_MODULE = os.getenv("DJANGO_SETTINGS_MODULE", "rankcatalyst.settings.dev")

if DJANGO_SETTINGS_MODULE == "rankcatalyst.settings.dev":
    from .settings.dev import *
elif DJANGO_SETTINGS_MODULE == "rankcatalyst.settings.prod":
    from .settings.prod import *
else:
    from .settings.base import *
