from django.contrib import admin

from . import models

for _m in (
    models.GroupeScolaire,
    models.Ecole,
    models.AnneeScolaire,
    models.ModaliteFormation,
    models.Niveau,
    models.Filiere,
    models.OptionFiliere,
    models.Classe,
    models.Matiere,
    models.Periode,
    models.SessionExamen,
):
    admin.site.register(_m)
