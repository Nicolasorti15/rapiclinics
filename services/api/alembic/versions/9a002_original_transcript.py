"""Preserve the raw automatic transcript separately from physician edits."""

from alembic import op
import sqlalchemy as sa

revision = "9a002"
down_revision = "9a001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("visits", sa.Column("original_transcript", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("visits", "original_transcript")
