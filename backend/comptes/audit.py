import json

from django.forms.models import model_to_dict

from .models import JournalAudit


def _snapshot(instance):
    brut = model_to_dict(instance)
    brut["id"] = instance.pk
    return json.loads(json.dumps(brut, default=str))


def _ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")


class AuditLogMixin:
    def _ecrire_audit(self, action, instance, avant=None, apres=None):
        JournalAudit.objects.create(
            utilisateur=(
                self.request.user if self.request.user.is_authenticated else None
            ),
            action=action,
            table_cible=self.get_queryset().model._meta.db_table,
            ligne_id=instance.pk,
            valeurs_avant=avant,
            valeurs_apres=apres,
            ip=_ip(self.request),
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._ecrire_audit("CREATION", instance, apres=_snapshot(instance))

    def perform_update(self, serializer):
        avant = _snapshot(serializer.instance)
        instance = serializer.save()
        self._ecrire_audit(
            "MODIFICATION", instance, avant=avant, apres=_snapshot(instance)
        )

    def perform_destroy(self, instance):
        avant = _snapshot(instance)
        pk = instance.pk
        instance.delete()
        instance.pk = pk
        self._ecrire_audit("SUPPRESSION", instance, avant=avant)
