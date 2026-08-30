from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


def _sante_fields():
    return {
        "status": drf_serializers.CharField(),
        "db": drf_serializers.CharField(),
    }


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        responses={
            200: inline_serializer("SanteReponse", _sante_fields()),
            503: inline_serializer("SanteDegradee", _sante_fields()),
        },
        tags=["monitoring"],
    )
    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception:
            return Response({"status": "ok", "db": "down"}, status=503)
        return Response({"status": "ok", "db": "ok"})
