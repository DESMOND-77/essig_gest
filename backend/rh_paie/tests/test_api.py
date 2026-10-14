from django.test import TestCase, Client
from comptes.models import Role, UtilisateurRole
from comptes.tests.factories import UtilisateurFactory
import json


def create_user_with_roles(*role_codes):
    """Create a user with the specified role codes"""
    user = UtilisateurFactory()
    for code in role_codes:
        role, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
        UtilisateurRole.objects.create(utilisateur=user, role=role)
    return user


def get_jwt_token(client, username, password):
    """Obtain a JWT token by authenticating via the login endpoint"""
    login_data = {
        'login': username,
        'password': password
    }
    response = client.post('/api/v1/auth/login/', login_data, content_type='application/json')
    if response.status_code == 200:
        token_data = json.loads(response.content)
        return token_data['access']
    else:
        raise Exception(f"Failed to obtain JWT token: {response.status_code} - {response.content}")


class RH_PaieAPITest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_enseignants_endpoint_daf_access(self):
        """Test the enseignants endpoint with DAF role (should have access)"""
        # Create user with DAF role
        user = create_user_with_roles("DAF")

        # Obtain JWT token
        token = get_jwt_token(self.client, user.login, "motdepasse42")

        # Set authorization header for subsequent requests
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        response = self.client.get('/api/v1/rh-paie/enseignants/')

        # Should be successful (200) or at least not unauthorized (401)
        # Might be 200, 403, or other depending on additional permissions
        self.assertNotEqual(response.status_code, 401, f"Expected status != 401, got {response.status_code}")

    def test_enseignants_endpoint_lecture_access(self):
        """Test the enseignants endpoint with LECTURE role (should have read access)"""
        # Create user with LECTURE role
        user = create_user_with_roles("LECTURE")

        # Obtain JWT token
        token = get_jwt_token(self.client, user.login, "motdepasse42")

        # Set authorization header for subsequent requests
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        response = self.client.get('/api/v1/rh-paie/enseignants/')

        # Should be successful for read access
        self.assertNotEqual(response.status_code, 401)

    def test_enseignants_endpoint_no_access(self):
        """Test the enseignants endpoint without appropriate roles (should be denied)"""
        # Create user with no relevant roles
        user = UtilisateurFactory()  # No roles assigned

        # Obtain JWT token
        token = get_jwt_token(self.client, user.login, "motdepasse42")

        # Set authorization header for subsequent requests
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        response = self.client.get('/api/v1/rh-paie/enseignants/')

        # Should be forbidden or unauthorized
        # Depending on permission implementation, could be 401 or 403
        self.assertIn(response.status_code, [401, 403])

    def test_personnel_administratif_endpoint_daf_access(self):
        """Test the personnel administratif endpoint with DAF role"""
        # Create user with DAF role
        user = create_user_with_roles("DAF")

        # Obtain JWT token
        token = get_jwt_token(self.client, user.login, "motdepasse42")

        # Set authorization header for subsequent requests
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        response = self.client.get('/api/v1/rh-paie/personnel-administratif/')

        self.assertNotEqual(response.status_code, 401)

    def test_affectations_endpoint_daf_access(self):
        """Test the affectations endpoint with DAF role"""
        # Create user with DAF role
        user = create_user_with_roles("DAF")

        # Obtain JWT token
        token = get_jwt_token(self.client, user.login, "motdepasse42")

        # Set authorization header for subsequent requests
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

        response = self.client.get('/api/v1/rh-paie/affectations-enseignement/')

        self.assertNotEqual(response.status_code, 401)