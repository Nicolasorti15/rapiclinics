"""add urgent tasks and device notification tokens

Revision ID: 9a007
Revises: 9a006
"""

from alembic import op
import sqlalchemy as sa

revision = "9a007"
down_revision = "9a006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tasks",
        sa.Column("urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "push_tokens",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )


def downgrade():
    op.drop_table("push_tokens")
    op.drop_column("tasks", "urgent")
