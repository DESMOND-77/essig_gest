from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, MoiSerializer


def _pose_cookie_refresh(response, refresh_value):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh_value),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({"detail": "Identifiants invalides."},
                            status=status.HTTP_401_UNAUTHORIZED)
        data = serializer.validated_data
        resp = Response({"access": data["access"]})
        _pose_cookie_refresh(resp, data["refresh"])
        return resp


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            return Response({"detail": "Refresh absent."},
                            status=status.HTTP_401_UNAUTHORIZED)
        try:
            token = RefreshToken(raw)
            access = str(token.access_token)
            if settings.SIMPLE_JWT["ROTATE_REFRESH_TOKENS"]:
                token.blacklist()
                new_refresh = RefreshToken.for_user(
                    _user_from_token(token)
                )
            else:
                new_refresh = token
        except TokenError:
            return Response({"detail": "Refresh invalide."},
                            status=status.HTTP_401_UNAUTHORIZED)
        resp = Response({"access": access})
        _pose_cookie_refresh(resp, new_refresh)
        return resp


def _user_from_token(token):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.get(pk=token["user_id"])


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        resp = Response(status=status.HTTP_205_RESET_CONTENT)
        resp.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
        return resp


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MoiSerializer(request.user).data)
