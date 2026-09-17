"""Reviewable laboratory reports."""

from alembic import op
import sqlalchemy as sa

revision = "9a003"
down_revision = "9a002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "lab_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("encounter_id", sa.String(), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("identity_status", sa.String(), nullable=False),
        sa.Column("rows", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("validated_by", sa.String(), sa.ForeignKey("users.id")),
        sa.UniqueConstraint("patient_id", "sha256", name="uq_lab_patient_hash"),
    )


def downgrade():
    op.drop_table("lab_reports")
