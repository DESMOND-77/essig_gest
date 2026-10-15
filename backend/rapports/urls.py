from django.urls import path

from . import views

urlpatterns = [
    path("situation-scolarite/", views.situation_scolarite, name="rapport-situation-scolarite"),
    path("situation-frais/", views.situation_frais, name="rapport-situation-frais"),
    path("echeancier/", views.echeancier, name="rapport-echeancier"),
    path("solde-compte/", views.solde_compte, name="rapport-solde-compte"),
    path("bilan-mensuel/", views.bilan_mensuel, name="rapport-bilan-mensuel"),
    path("bilan-consolide/", views.bilan_consolide, name="rapport-bilan-consolide"),
    path(
        "etat-scolarite-etudiant/",
        views.etat_scolarite_etudiant,
        name="rapport-etat-scolarite-etudiant",
    ),
    path("resultat-matiere/", views.resultat_matiere, name="rapport-resultat-matiere"),
    path("bulletin-periode/", views.bulletin_periode, name="rapport-bulletin-periode"),
    path("resultat-annuel/", views.resultat_annuel, name="rapport-resultat-annuel"),
    path("masse-salariale/", views.masse_salariale, name="rapport-masse-salariale"),
    path("paie-enseignant/", views.paie_enseignant, name="rapport-paie-enseignant"),
    path("arrete-caisse/", views.arrete_caisse, name="rapport-arrete-caisse"),
    path("tableau-de-bord/", views.tableau_de_bord, name="rapport-tableau-de-bord"),
]
