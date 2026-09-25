"""add role to staff invitations

Revision ID: 9a006
Revises: 9a005
"""

from alembic import op
import sqlalchemy as sa

revision = "9a006"
down_revision = "9a005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "invitations",
        sa.Column("role", sa.String(), nullable=False, server_default="PHYSICIAN"),
    )


def downgrade():
    op.drop_column("invitations", "role")
