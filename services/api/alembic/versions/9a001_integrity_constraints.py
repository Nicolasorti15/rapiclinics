"""Enforce patient consistency and human confirmation in the database."""

from alembic import op

revision = "9a001"
down_revision = "7c884ce8f138"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("encounters") as batch:
        batch.create_unique_constraint("encounter_patient_pair", ["id", "patient_id"])
    with op.batch_alter_table("visits") as batch:
        batch.create_foreign_key(
            "visit_encounter_patient", "encounters", ["encounter_id", "patient_id"], ["id", "patient_id"]
        )
        batch.create_check_constraint(
            "visit_human_validation",
            "status != 'CONFIRMED' OR (validated_by IS NOT NULL AND confirmed_at IS NOT NULL)",
        )
    with op.batch_alter_table("tasks") as batch:
        batch.create_foreign_key(
            "task_encounter_patient", "encounters", ["encounter_id", "patient_id"], ["id", "patient_id"]
        )
    with op.batch_alter_table("documents") as batch:
        batch.create_foreign_key(
            "document_encounter_candidate",
            "encounters",
            ["encounter_id", "candidate_patient_id"],
            ["id", "patient_id"],
        )
        batch.create_check_constraint(
            "document_identity_association", "patient_id IS NULL OR patient_id = candidate_patient_id"
        )
        batch.create_check_constraint(
            "document_human_validation",
            "status != 'VALIDATED' OR (patient_id IS NOT NULL AND validated_by IS NOT NULL AND validated_at IS NOT NULL AND identity_status != 'MISMATCH')",
        )


def downgrade():
    with op.batch_alter_table("documents") as batch:
        batch.drop_constraint("document_human_validation", type_="check")
        batch.drop_constraint("document_identity_association", type_="check")
        batch.drop_constraint("document_encounter_candidate", type_="foreignkey")
    with op.batch_alter_table("tasks") as batch:
        batch.drop_constraint("task_encounter_patient", type_="foreignkey")
    with op.batch_alter_table("visits") as batch:
        batch.drop_constraint("visit_human_validation", type_="check")
        batch.drop_constraint("visit_encounter_patient", type_="foreignkey")
    with op.batch_alter_table("encounters") as batch:
        batch.drop_constraint("encounter_patient_pair", type_="unique")
