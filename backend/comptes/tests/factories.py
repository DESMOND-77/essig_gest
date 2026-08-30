import factory

from comptes.models import Utilisateur


class UtilisateurFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Utilisateur
        skip_postgeneration_save = True

    login = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.login}@ex.ga")

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        obj.set_password(extracted or "motdepasse42")
        if create:
            obj.save()
