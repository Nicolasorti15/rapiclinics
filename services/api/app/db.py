import os
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .settings import database_url


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


DATABASE_URL = database_url(os.getenv("DATABASE_URL", "sqlite:///./rapiclinics.db"))
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def sqlite_constraints(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def db_session():
    with SessionLocal() as db:
        yield db
