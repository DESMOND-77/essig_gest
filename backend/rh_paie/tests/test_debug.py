from django.test import TestCase
from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
from rh_paie.permissions import RH_PaiePermission
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest


def create_user_with_roles(*role_codes):
    """Create a user with the specified role codes"""
    user = UtilisateurFactory()
    for code in role_codes:
        role, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
        UtilisateurRole.objects.create(utilisateur=user, role=role)
    return user


class RPHaiePermissionTest(TestCase):
    def setUp(self):
        self.permission = RH_PaiePermission()
        self.factory = HttpRequest()

    def test_daf_user_has_read_access(self):
        """Test that a DAF user has read access"""
        user = create_user_with_roles("DAF")
        request = HttpRequest()
        request.user = user
        request.method = 'GET'

        has_permission = self.permission.has_permission(request, None)
        self.assertTrue(has_permission, "DAF user should have read access")

    def test_daf_user_has_write_access(self):
        """Test that a DAF user has write access"""
        user = create_user_with_roles("DAF")
        request = HttpRequest()
        request.user = user
        request.method = 'POST'

        has_permission = self.permission.has_permission(request, None)
        self.assertTrue(has_permission, "DAF user should have write access")

    def test_lecture_user_has_read_access(self):
        """Test that a LECTURE user has read access"""
        user = create_user_with_roles("LECTURE")
        request = HttpRequest()
        request.user = user
        request.method = 'GET'

        has_permission = self.permission.has_permission(request, None)
        self.assertTrue(has_permission, "LECTURE user should have read access")

    def test_lecture_user_has_no_write_access(self):
        """Test that a LECTURE user does not have write access"""
        user = create_user_with_roles("LECTURE")
        request = HttpRequest()
        request.user = user
        request.method = 'POST'

        has_permission = self.permission.has_permission(request, None)
        self.assertFalse(has_permission, "LECTURE user should not have write access")

    def test_user_without_roles_has_no_access(self):
        """Test that a user without relevant roles has no access"""
        user = UtilisateurFactory()  # No roles assigned
        request = HttpRequest()
        request.user = user
        request.method = 'GET'

        has_permission = self.permission.has_permission(request, None)
        self.assertFalse(has_permission, "User without roles should have no access")

    def test_anonymous_user_has_no_access(self):
        """Test that an anonymous user has no access"""
        request = HttpRequest()
        request.user = AnonymousUser()
        request.method = 'GET'

        has_permission = self.permission.has_permission(request, None)
        self.assertFalse(has_permission, "Anonymous user should have no access")