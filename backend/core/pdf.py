"""Utilitaires de génération de PDF via WeasyPrint."""

from django.template.loader import render_to_string
from weasyprint import HTML


def render_pdf(template_name: str, context: dict) -> bytes:
    """Rend un template Django en PDF (bytes) via WeasyPrint.

    Args:
        template_name: chemin du template (ex: "pdf/releve.html").
        context: contexte de rendu du template.

    Returns:
        Le contenu binaire du PDF généré.
    """
    html_string = render_to_string(template_name, context)
    return HTML(string=html_string, base_url=".").write_pdf()
