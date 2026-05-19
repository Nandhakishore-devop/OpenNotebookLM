import io
from minio import Minio
from app.core.config import settings

def get_minio_client() -> Minio:
    return Minio(
        settings.MINIO_URL,
        access_key=settings.MINIO_ROOT_USER,
        secret_key=settings.MINIO_ROOT_PASSWORD,
        secure=settings.MINIO_SECURE
    )

def ensure_bucket_exists(client: Minio, bucket_name: str):
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)

def upload_file_to_minio(client: Minio, bucket_name: str, object_name: str, data: bytes, content_type: str):
    ensure_bucket_exists(client, bucket_name)
    client.put_object(
        bucket_name=bucket_name,
        object_name=object_name,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type
    )
