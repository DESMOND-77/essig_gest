from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception:
            return Response({"status": "ok", "db": "down"}, status=503)
        return Response({"status": "ok", "db": "ok"})
