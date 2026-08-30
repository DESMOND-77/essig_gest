from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "login"


class MoiSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    login = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()

    def get_roles(self, obj):
        mgr = getattr(obj, "roles", None)
        if mgr is None:
            return []
        return [{"code": ur.role.code, "ecole_id": ur.ecole_id}
                for ur in mgr.select_related("role").all()]
