import os
from pathlib import Path

from cryptography.fernet import Fernet


class ObjectStorage:
    """Encrypted objects with random names, never updated through this interface."""

    def __init__(self):
        self.root = Path(os.getenv("STORAGE_PATH", "data/objects"))
        self.root.mkdir(parents=True, exist_ok=True)
        key = os.getenv("STORAGE_ENCRYPTION_KEY")
        if not key:
            if os.getenv("APP_ENV", "development") != "development":
                raise RuntimeError("STORAGE_ENCRYPTION_KEY is required")
            key_file = self.root.parent / ".storage-key"
            if not key_file.exists():
                key_file.write_bytes(Fernet.generate_key())
            key = key_file.read_bytes()
        self.cipher = Fernet(key)
        self.database = (
            os.getenv("STORAGE_BACKEND", "database" if os.getenv("APP_MODE") == "clinical" else "files")
            == "database"
        )
        self.s3 = None
        if os.getenv("S3_ENDPOINT") and not self.database:
            import boto3

            self.s3 = boto3.client(
                "s3",
                endpoint_url=os.environ["S3_ENDPOINT"],
                aws_access_key_id=os.environ["S3_ACCESS_KEY"],
                aws_secret_access_key=os.environ["S3_SECRET_KEY"],
            )
            self.bucket = os.getenv("S3_BUCKET", "rapiclinics")

    def put(self, key: str, content: bytes, db=None):
        encrypted = self.cipher.encrypt(content)
        if self.database:
            from .db import SessionLocal
            from .models import StoredObject

            if db is not None:
                db.add(StoredObject(id=key, encrypted_content=encrypted))
                db.flush()
            else:
                with SessionLocal() as session:
                    session.add(StoredObject(id=key, encrypted_content=encrypted))
                    session.commit()
        elif self.s3:
            self.s3.put_object(Bucket=self.bucket, Key=key, Body=encrypted, IfNoneMatch="*")
        else:
            with (self.root / key).open("xb") as handle:
                handle.write(encrypted)

    def get(self, key: str):
        if self.database:
            from .db import SessionLocal
            from .models import StoredObject

            with SessionLocal() as db:
                item = db.get(StoredObject, key)
                if not item:
                    raise FileNotFoundError("Stored object unavailable")
                return self.cipher.decrypt(item.encrypted_content)
        content = (
            self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
            if self.s3
            else (self.root / key).read_bytes()
        )
        return self.cipher.decrypt(content)
