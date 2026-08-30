import json

from django.core.exceptions import ValidationError
from django.core.validators import validate_ipv46_address
from django.forms.models import model_to_dict

from .models import JournalAudit

# Champs jamais journalises : empreintes de mot de passe, jetons, secrets.
CHAMPS_SENSIBLES = {"password", "mot_de_passe_hash", "token", "secret"}


def _snapshot(instance, exclus=CHAMPS_SENSIBLES):
    brut = model_to_dict(instance)
    brut["id"] = instance.pk
    brut = {k: v for k, v in brut.items() if k not in exclus}
    return json.loads(json.dumps(brut, default=str))


def _ip(request):
    """IP client fiable : derniere entree de X-Forwarded-For (vue de Caddy,
    cf. `NUM_PROXIES = 1`), validee — une valeur forgee est ignoree."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    candidat = xff.split(",")[-1].strip() if xff else request.META.get("REMOTE_ADDR")
    if not candidat:
        return None
    try:
        validate_ipv46_address(candidat)
    except ValidationError:
        return None
    return candidat


class AuditLogMixin:
    #: champs supplementaires a exclure des instantanes, par ViewSet.
    champs_audit_exclus: set[str] = set()

    def _exclus(self):
        return CHAMPS_SENSIBLES | set(self.champs_audit_exclus)

    def _ecrire_audit(self, action, instance, avant=None, apres=None):
        JournalAudit.objects.create(
            utilisateur=(
                self.request.user if self.request.user.is_authenticated else None
            ),
            action=action,
            table_cible=instance._meta.db_table,
            ligne_id=instance.pk,
            valeurs_avant=avant,
            valeurs_apres=apres,
            ip=_ip(self.request),
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._ecrire_audit(
            "CREATION", instance, apres=_snapshot(instance, self._exclus())
        )

    def perform_update(self, serializer):
        avant = _snapshot(serializer.instance, self._exclus())
        instance = serializer.save()
        self._ecrire_audit(
            "MODIFICATION", instance, avant=avant,
            apres=_snapshot(instance, self._exclus()),
        )

    def perform_destroy(self, instance):
        avant = _snapshot(instance, self._exclus())
        pk = instance.pk
        instance.delete()
        instance.pk = pk
        self._ecrire_audit("SUPPRESSION", instance, avant=avant)
