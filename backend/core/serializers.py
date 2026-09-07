class AuditableSerializerMixin:
    """À combiner avec `ModelSerializer` sur un modèle héritant de `core.models.Auditable`.

    Pose `cree_par` à la création et `modifie_par` à la mise à jour depuis
    `context["request"].user`. Le serializer concret doit déclarer
    `cree_par`, `modifie_par`, `cree_le`, `modifie_le` en `read_only`.
    """

    def _utilisateur_courant(self):
        req = self.context.get("request")
        user = getattr(req, "user", None)
        return user if (user is not None and user.is_authenticated) else None

    def create(self, validated_data):
        u = self._utilisateur_courant()
        if u is not None:
            validated_data["cree_par"] = u
        return super().create(validated_data)

    def update(self, instance, validated_data):
        u = self._utilisateur_courant()
        if u is not None:
            validated_data["modifie_par"] = u
        return super().update(instance, validated_data)
