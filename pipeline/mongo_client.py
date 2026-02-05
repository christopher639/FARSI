from pymongo import MongoClient
from pymongo.server_api import ServerApi
from .config import get_mongo_config


def get_mongo_client() -> MongoClient:
    cfg = get_mongo_config()
    return MongoClient(cfg.uri, server_api=ServerApi("1"))


def _crime_events_validator():
    return {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["crime_type", "latitude", "longitude", "geo", "record_hash"],
            "properties": {
                "crime_type": {"bsonType": "string"},
                "month": {"bsonType": ["string", "null"]},
                "location": {"bsonType": ["string", "null"]},
                "longitude": {"bsonType": "double"},
                "latitude": {"bsonType": "double"},
                "reported_by": {"bsonType": ["string", "null"]},
                "falls_within": {"bsonType": ["string", "null"]},
                "lsoa_code": {"bsonType": ["string", "null"]},
                "lsoa_name": {"bsonType": ["string", "null"]},
                "last_outcome_category": {"bsonType": ["string", "null"]},
                "crime_id": {"bsonType": ["string", "null"]},
                "context": {"bsonType": ["string", "null"]},
                "record_hash": {"bsonType": "string"},
                "geo": {
                    "bsonType": "object",
                    "required": ["type", "coordinates"],
                    "properties": {
                        "type": {"enum": ["Point"]},
                        "coordinates": {
                            "bsonType": "array",
                            "items": [{"bsonType": "double"}, {"bsonType": "double"}],
                            "minItems": 2,
                            "maxItems": 2,
                        },
                    },
                },
            },
            "additionalProperties": True,
        }
    }


def ensure_collection():
    cfg = get_mongo_config()
    client = get_mongo_client()
    db = client[cfg.db]

    if cfg.collection not in db.list_collection_names():
        db.create_collection(
            cfg.collection,
            validator=_crime_events_validator(),
            validationLevel="moderate",
        )
    else:
        try:
            db.command(
                "collMod",
                cfg.collection,
                validator=_crime_events_validator(),
                validationLevel="moderate",
            )
        except Exception:
            # If collMod fails due to permissions, continue without blocking.
            pass


def get_collection():
    cfg = get_mongo_config()
    client = get_mongo_client()
    return client[cfg.db][cfg.collection]
