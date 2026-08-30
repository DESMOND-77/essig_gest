from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "login"


class LoginRequeteSerializer(serializers.Serializer):
    login = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class AccessTokenSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)


class RoleAffecteSerializer(serializers.Serializer):
    code = serializers.CharField()
    ecole_id = serializers.IntegerField(allow_null=True)


class MoiSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    login = serializers.CharField(read_only=True)
    email = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()

    @extend_schema_field(RoleAffecteSerializer(many=True))
    def get_roles(self, obj):
        return [
            {"code": ur.role.code, "ecole_id": ur.ecole_id}
            for ur in obj.roles.select_related("role").all()
        ]
