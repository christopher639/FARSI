from pymongo import MongoClient
from pymongo.server_api import ServerApi
from .config import get_mongo_config


def get_mongo_client() -> MongoClient:
    cfg = get_mongo_config()
    return MongoClient(cfg.uri, server_api=ServerApi("1"))


def get_collection():
    cfg = get_mongo_config()
    client = get_mongo_client()
    return client[cfg.db][cfg.collection]
