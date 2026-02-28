from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..ml.network_graph import build_graph_rows, hidden_connections, run_gnn_risk_scoring
from ..neo4j_client import neo4j_enabled, run_read, run_write
from ..supabase_client import get_supabase


router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/nodes", response_model=list[dict])
def list_nodes(_: str | None = Depends(allow_public_read("graph.read"))):
    supabase = get_supabase()
    result = supabase.table("entity_nodes").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []


@router.get("/edges", response_model=list[dict])
def list_edges(_: str | None = Depends(allow_public_read("graph.read"))):
    supabase = get_supabase()
    result = supabase.table("entity_edges").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []


@router.post("/nodes", response_model=dict)
def create_node(payload: dict, _: str = Depends(require_permission("graph.write"))):
    supabase = get_supabase()
    created = supabase.table("entity_nodes").insert(payload).execute()
    return created.data[0]


@router.post("/edges", response_model=dict)
def create_edge(payload: dict, _: str = Depends(require_permission("graph.write"))):
    supabase = get_supabase()
    created = supabase.table("entity_edges").insert(payload).execute()
    return created.data[0]


def _load_source_rows(limit: int = 5000) -> tuple[list[dict], list[dict]]:
    supabase = get_supabase()
    network_result = (
        supabase.table("network_analysis_data")
        .select("source_ip,destination_ip,protocol,threat_detected")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    event_result = (
        supabase.table("ingestion_events")
        .select("title,description,location,entities,created_at,severity")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    events = event_result.data or []
    for event in events:
        sev = str(event.get("severity") or "").lower()
        event["severity_score"] = 1.0 if sev in {"critical", "high"} else (0.75 if sev == "medium" else 0.5)
    return network_result.data or [], events


@router.post("/rebuild")
def rebuild_graph(
    clear_existing: bool = True,
    _: str = Depends(require_permission("graph.write")),
):
    supabase = get_supabase()
    network_rows, event_rows = _load_source_rows()
    nodes, edges = build_graph_rows(network_rows, event_rows)
    gnn = run_gnn_risk_scoring(nodes, edges)
    risk_by_node = gnn["risk_by_node"]
    now = datetime.now(timezone.utc).isoformat()

    node_rows = []
    for node in nodes:
        label = node["label"]
        props = dict(node.get("properties") or {})
        props["threat"] = risk_by_node.get(label, 0.0) >= 0.6
        props["risk_score"] = round(risk_by_node.get(label, 0.0), 4)
        props["updated_at"] = now
        node_rows.append(
            {
                "label": label,
                "entity_type": node.get("entity_type", "person"),
                "properties": props,
                "created_at": now,
            }
        )

    node_ids_by_label = {row["label"]: f"tmp:{idx}" for idx, row in enumerate(node_rows)}
    edge_rows = []
    for edge in edges:
        s_label = edge["source_id"]
        t_label = edge["target_id"]
        edge_rows.append(
            {
                "source_id": node_ids_by_label.get(s_label, s_label),
                "target_id": node_ids_by_label.get(t_label, t_label),
                "relationship": edge.get("relationship", "related_to"),
                "properties": edge.get("properties", {}),
                "created_at": now,
            }
        )

    if clear_existing:
        supabase.table("entity_edges").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        supabase.table("entity_nodes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    inserted_nodes = []
    if node_rows:
        inserted_nodes = supabase.table("entity_nodes").insert(node_rows).execute().data or []

    real_id_by_label = {row.get("label"): row.get("id") for row in inserted_nodes}
    for edge_row in edge_rows:
        src = str(edge_row["source_id"])
        dst = str(edge_row["target_id"])
        if src.startswith("tmp:"):
            idx = int(src.split(":", 1)[1])
            label = node_rows[idx]["label"]
            edge_row["source_id"] = real_id_by_label.get(label)
        if dst.startswith("tmp:"):
            idx = int(dst.split(":", 1)[1])
            label = node_rows[idx]["label"]
            edge_row["target_id"] = real_id_by_label.get(label)

    edge_rows = [e for e in edge_rows if e.get("source_id") and e.get("target_id")]
    inserted_edges = []
    if edge_rows:
        inserted_edges = supabase.table("entity_edges").insert(edge_rows).execute().data or []

    neo4j_synced = 0
    if neo4j_enabled() and inserted_nodes:
        run_write("MATCH (n) DETACH DELETE n")
        run_write(
            """
            UNWIND $nodes AS node
            MERGE (n:Entity {id: node.id})
            SET n.label = node.label,
                n.entity_type = node.entity_type,
                n.risk_score = node.risk_score,
                n.threat = node.threat
            """,
            {
                "nodes": [
                    {
                        "id": row["id"],
                        "label": row["label"],
                        "entity_type": row.get("entity_type"),
                        "risk_score": float((row.get("properties") or {}).get("risk_score", 0.0)),
                        "threat": bool((row.get("properties") or {}).get("threat", False)),
                    }
                    for row in inserted_nodes
                ]
            },
        )
        run_write(
            """
            UNWIND $edges AS edge
            MATCH (s:Entity {id: edge.source_id})
            MATCH (t:Entity {id: edge.target_id})
            MERGE (s)-[r:RELATED_TO {relationship: edge.relationship}]->(t)
            SET r.weight = edge.weight
            """,
            {
                "edges": [
                    {
                        "source_id": row["source_id"],
                        "target_id": row["target_id"],
                        "relationship": row.get("relationship", "related_to"),
                        "weight": float((row.get("properties") or {}).get("weight", 1.0)),
                    }
                    for row in edge_rows
                ]
            },
        )
        neo4j_synced = len(inserted_nodes)

    return {
        "nodes": len(inserted_nodes),
        "edges": len(inserted_edges),
        "neo4j_synced_nodes": neo4j_synced,
        "gnn_model": gnn["model"],
        "top_entities": gnn["top_entities"][:10],
    }


@router.get("/intelligence")
def graph_intelligence(_: str | None = Depends(allow_public_read("graph.read"))):
    supabase = get_supabase()
    nodes = supabase.table("entity_nodes").select("*").limit(2000).execute().data or []
    edges = supabase.table("entity_edges").select("*").limit(3000).execute().data or []
    if not nodes:
        return {
            "nodes": [],
            "edges": [],
            "hidden_connections": [],
            "gnn": {"model": "graph-message-passing-v1", "top_entities": []},
            "neo4j": {"enabled": neo4j_enabled(), "query_results": []},
        }

    gnn = run_gnn_risk_scoring(nodes, edges)
    hidden = hidden_connections(nodes, edges)
    neo4j_paths = []
    if neo4j_enabled():
        neo4j_paths = run_read(
            """
            MATCH p = (a:Entity)-[:RELATED_TO*2..3]->(b:Entity)
            WHERE a.id <> b.id AND coalesce(a.threat,false)=true AND coalesce(b.threat,false)=true
            RETURN a.id as source_id, b.id as target_id, length(p) as hops
            LIMIT 50
            """
        )
    return {
        "nodes": nodes,
        "edges": edges,
        "hidden_connections": hidden,
        "gnn": gnn,
        "neo4j": {"enabled": neo4j_enabled(), "query_results": neo4j_paths},
    }
