from bson import ObjectId
from datetime import date, datetime


def serialize(doc: dict) -> dict:
    """Convert a Mongo document into a JSON-safe dict (str ids, no internal fields)."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        elif k == "password_hash":
            continue
        else:
            out[k] = v
    return out


def serialize_list(docs) -> list:
    return [serialize(d) for d in docs]


def to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise ValueError("Invalid id format")
