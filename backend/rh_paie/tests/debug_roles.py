    print(f"User login: {user.login}")
    user = create_user_with_roles("DAF")
    print("=== Testing role assignment ===")
if __name__ == '__main__':

    return user

    print(f"User roles as flat list: {list(user_roles_flat)}")
    user_roles_flat = user.roles.values_list('role__code', flat=True)

        print(f"  - {ur.role.code}")
    for ur in user_roles:
    print(f"User has {user_roles.count()} roles via user.roles:")
    user_roles = user.roles.all()
    # Check what roles the user has

        print(f"  Added role: {role.code} (UtilisateurRole ID: {user_role.id})")
        user_role = UtilisateurRole.objects.create(utilisateur=user, role=role)
        role, _ = Role.objects.get_or_create(code=code, defaults={"libelle": code})
    for code in role_codes:
    print(f"Created user: {user.login}, actif: {user.actif}")
    user = UtilisateurFactory()
    """Create a user with the specified role codes"""
def create_user_with_roles(*role_codes):

from comptes.tests.factories import UtilisateurFactory
from comptes.models import Role, UtilisateurRole

django.setup()
sys.path.append('/home/foxtrot/Documents/ESSIG/el_Amine/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
# Setup Django

import django
import sys
import os
"""
Debug script to check role assignment
"""
#!/usr/bin/env python