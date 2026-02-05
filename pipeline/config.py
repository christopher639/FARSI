import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class MongoConfig:
    uri: str
    db: str
    collection: str


def get_mongo_config() -> MongoConfig:
    uri = os.getenv("MONGODB_URI", "")
    db = os.getenv("MONGODB_DB", "FARSI")
    collection = os.getenv("MONGODB_COLLECTION", "crime_events")
    if not uri:
        raise ValueError("MONGODB_URI is not set. Add it to .env")
    return MongoConfig(uri=uri, db=db, collection=collection)
