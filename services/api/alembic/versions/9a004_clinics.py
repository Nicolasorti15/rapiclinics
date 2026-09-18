"""Clinic boundaries, registration invitations and patient NFC tags."""

from alembic import op
import sqlalchemy as sa

revision = "9a004"
down_revision = "9a003"
branch_labels = depends_on = None


def unique_name(table, column):
    constraints = sa.inspect(op.get_bind()).get_unique_constraints(table)
    matches = [item for item in constraints if item["column_names"] == [column]]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one unique constraint for {table}.{column}")
    # PostgreSQL names unnamed constraints itself; SQLite uses batch naming.
    return matches[0]["name"] or f"uq_{table}_{column}"


def upgrade():
    patient_unique = unique_name("patients", "identifier")
    bed_unique = unique_name("beds", "code")
    document_unique = unique_name("documents", "sha256")
    op.create_table(
        "clinics",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email_domain", sa.String()),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    op.execute(
        sa.text(
            "INSERT INTO clinics (id, name, active, created_at) VALUES ('demo', 'Clínica de demostración', true, '2026-09-17T00:00:00+00:00')"
        )
    )
    convention = {"uq": "uq_%(table_name)s_%(column_0_name)s"}
    for table in ("users", "patients", "beds", "encounters"):
        with op.batch_alter_table(table, naming_convention=convention) as batch:
            batch.add_column(sa.Column("clinic_id", sa.String(), nullable=False, server_default="demo"))
            batch.create_foreign_key(f"fk_{table}_clinic", "clinics", ["clinic_id"], ["id"])
            if table == "patients":
                batch.add_column(sa.Column("document_type", sa.String(), nullable=False, server_default="CC"))
                batch.drop_constraint(patient_unique, type_="unique")
                batch.create_unique_constraint(
                    "uq_patient_clinic_document", ["clinic_id", "document_type", "identifier"]
                )
            if table == "beds":
                batch.drop_constraint(bed_unique, type_="unique")
                batch.create_unique_constraint("uq_bed_clinic_code", ["clinic_id", "code"])
    with op.batch_alter_table("documents", naming_convention=convention) as batch:
        batch.drop_constraint(document_unique, type_="unique")
        batch.create_unique_constraint("uq_document_patient_hash", ["candidate_patient_id", "sha256"])
    with op.batch_alter_table("tags") as batch:
        batch.alter_column("bed_id", existing_type=sa.String(), nullable=True)
        batch.add_column(sa.Column("patient_id", sa.String()))
        batch.create_foreign_key("fk_tag_patient", "patients", ["patient_id"], ["id"])
        batch.create_check_constraint(
            "tag_single_target",
            "(bed_id IS NOT NULL AND patient_id IS NULL) OR (bed_id IS NULL AND patient_id IS NOT NULL)",
        )
    op.create_index(
        "one_active_patient_tag",
        "tags",
        ["patient_id"],
        unique=True,
        sqlite_where=sa.text("status = 'ACTIVE'"),
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_table(
        "invitations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("clinic_id", sa.String(), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), unique=True, nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_table(
        "stored_objects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("encrypted_content", sa.LargeBinary(), nullable=False),
    )


def downgrade():
    raise RuntimeError("This migration preserves clinic boundaries. Restore a verified backup to roll back.")
