from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    mongo_uri: str = "mongodb+srv://bharteshsingh11_db_user:VmIrw2vUQJQduFOZ@cluster0.1asaoly.mongodb.net"
    mongo_db_name: str = "rentflow"

    jwt_secret: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    owner_email: str = "owner@rentflow.local"
    owner_password: str = "changeme123"
    owner_name: str = "Property Owner"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@rentflow.local"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
