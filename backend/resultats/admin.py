from django.contrib import admin

from .models import Deliberation, DetteCredit, ResultatAnnuel, ResultatMatiere, ResultatPeriode

admin.site.register(Deliberation)
admin.site.register(DetteCredit)
admin.site.register(ResultatMatiere)
admin.site.register(ResultatPeriode)
admin.site.register(ResultatAnnuel)
