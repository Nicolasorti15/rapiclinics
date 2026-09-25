"""Preserve patient records across discharge and readmission."""

from alembic import op
import sqlalchemy as sa


revision = "9a005"
down_revision = "9a004"
branch_labels = depends_on = None


def upgrade():
    with op.batch_alter_table("encounters") as batch:
        batch.add_column(sa.Column("discharged_at", sa.String()))
    op.create_index(
        "one_active_patient_encounter",
        "encounters",
        ["patient_id"],
        unique=True,
        sqlite_where=sa.text("status = 'ACTIVE'"),
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )


def downgrade():
    raise RuntimeError("Patient discharge history is retained. Restore a verified backup to roll back.")
