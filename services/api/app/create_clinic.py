"""Operator-only clinic bootstrap. Never exposes an anonymous admin signup route."""

import getpass

from .administration import normalize_email
from .db import SessionLocal
from .models import Clinic, User
from .security import audit, hasher


def create_clinic(db, name, email_domain, email, admin_name, password):
    email = normalize_email(email)
    domain = email_domain.strip().lower() or None
    if not name.strip() or not admin_name.strip() or len(password) < 12 or len(password) > 128:
        raise ValueError("Nombre, administrador y contraseña de 12 a 128 caracteres requeridos.")
    if domain and email.split("@")[-1] != domain:
        raise ValueError("El correo del administrador debe pertenecer al dominio configurado.")
    clinic = Clinic(name=name.strip(), email_domain=domain)
    db.add(clinic)
    db.flush()
    user = User(
        clinic_id=clinic.id,
        name=admin_name.strip(),
        email=email,
        role="ADMIN",
        password_hash=hasher.hash(password),
        unit="Administración",
    )
    db.add(user)
    db.flush()
    audit(db, user, "clinic_created", clinic.id)
    db.commit()
    return clinic


def main():
    name = input("Nombre de la clínica: ")
    domain = input("Dominio laboral (ej. clinica.com; vacío si no se restringe): ")
    email = input("Correo del administrador: ")
    admin_name = input("Nombre del administrador: ")
    password = getpass.getpass("Contraseña (mínimo 12 caracteres): ")
    if password != getpass.getpass("Repite la contraseña: "):
        raise ValueError("Las contraseñas no coinciden.")
    with SessionLocal() as db:
        clinic = create_clinic(db, name, domain, email, admin_name, password)
        print(f"Clínica creada: {clinic.name}. El administrador ya puede iniciar sesión.")


if __name__ == "__main__":
    main()
