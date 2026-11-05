import os
import sqlite3
from datetime import datetime, timezone

from flask import Flask, g, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "manutri.db")
SCHEMA = os.path.join(BASE_DIR, "database", "schema.sql")
SEED = os.path.join(BASE_DIR, "database", "seed.sql")

CRITICALIDADES = ("baixa", "média", "alta")
PRIORIDADES = ("baixa", "média", "alta", "urgente")

app = Flask(__name__, static_folder="static", static_url_path="/static")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    with open(SCHEMA, encoding="utf-8") as f:
        db.executescript(f.read())
    primeira_vez = db.execute("SELECT 1 FROM config WHERE chave = 'exemplo'").fetchone() is None
    if primeira_vez and db.execute("SELECT COUNT(*) FROM equipment").fetchone()[0] == 0:
        with open(SEED, encoding="utf-8") as f:
            db.executescript(f.read())
    db.commit()
    db.close()


def agora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def erro(msg, status=400):
    return jsonify(erro=msg), status


def texto(dados, campo):
    return (dados.get(campo) or "").strip()


# ---------- Páginas ----------
@app.get("/")
def index():
    return send_from_directory(os.path.join(BASE_DIR, "templates"), "index.html")


# ---------- API ----------
@app.get("/api/dados")
def dados():
    db = get_db()
    equipamentos = [dict(r) for r in db.execute("SELECT * FROM equipment ORDER BY id")]
    ordens = [dict(r) for r in db.execute("SELECT * FROM service_orders ORDER BY id")]
    exemplo = (db.execute("SELECT valor FROM config WHERE chave = 'exemplo'").fetchone() or {"valor": "0"})["valor"] == "1"
    return jsonify(equipamentos=equipamentos, ordens=ordens, exemplo=exemplo)


@app.post("/api/equipamentos")
def criar_equipamento():
    d = request.get_json(silent=True) or {}
    code, name, sector = texto(d, "code"), texto(d, "name"), texto(d, "sector")
    crit = d.get("criticality") or ""
    if not code or not name or not sector or crit not in CRITICALIDADES:
        return erro("Preencha identificação, nome, setor e uma criticidade válida.")
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO equipment (code, name, sector, criticality, created_at) VALUES (?, ?, ?, ?, ?)",
            (code, name, sector, crit, agora()),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return erro("Já existe um equipamento com essa identificação.", 409)
    return jsonify(id=cur.lastrowid), 201


@app.post("/api/ordens")
def criar_ordem():
    d = request.get_json(silent=True) or {}
    desc = texto(d, "failure_description")
    prio = d.get("priority") or ""
    try:
        eid = int(d.get("equipment_id"))
    except (TypeError, ValueError):
        eid = 0
    db = get_db()
    existe = db.execute("SELECT 1 FROM equipment WHERE id = ?", (eid,)).fetchone()
    if not eid or not existe or not desc or prio not in PRIORIDADES:
        return erro("Selecione um equipamento e preencha a falha e uma prioridade válida.")
    cur = db.execute(
        "INSERT INTO service_orders (equipment_id, failure_description, priority, status, opened_at) "
        "VALUES (?, ?, ?, 'aberta', ?)",
        (eid, desc, prio, agora()),
    )
    db.commit()
    return jsonify(id=cur.lastrowid), 201


@app.post("/api/ordens/<int:os_id>/acao")
def acao_ordem(os_id):
    d = request.get_json(silent=True) or {}
    action = d.get("action")
    db = get_db()
    o = db.execute("SELECT * FROM service_orders WHERE id = ?", (os_id,)).fetchone()
    if o is None:
        return erro("Ordem não encontrada.", 404)
    tech = texto(d, "technician")

    if action == "assign":
        if not tech:
            return erro("Informe o técnico responsável.")
        if o["status"] == "concluída":
            return erro("Uma ordem concluída não pode ser reaberta nem alterada.")
        db.execute("UPDATE service_orders SET technician = ? WHERE id = ?", (tech, os_id))
        msg = "Técnico responsável atualizado."

    elif action == "start":
        resp = tech or (o["technician"] or "").strip()
        if not resp:
            return erro("Informe o técnico responsável antes de iniciar.")
        if o["status"] == "concluída":
            return erro("Uma ordem concluída não pode ser iniciada novamente.")
        db.execute(
            "UPDATE service_orders SET technician = ?, started_at = COALESCE(started_at, ?), "
            "status = 'em atendimento' WHERE id = ?",
            (resp, agora(), os_id),
        )
        msg = "Atendimento iniciado."

    elif action == "status":
        st = d.get("status") or ""
        if st not in ("aberta", "aguardando peça", "em atendimento") or not o["started_at"]:
            return erro("Situação inválida ou atendimento ainda não iniciado.")
        if o["status"] == "concluída":
            return erro("Uma ordem concluída não pode ser reaberta nem alterada.")
        db.execute("UPDATE service_orders SET status = ? WHERE id = ?", (st, os_id))
        msg = "Situação atualizada."

    elif action == "complete":
        cause, work, parts = texto(d, "failure_cause"), texto(d, "work_performed"), texto(d, "parts_used")
        if not o["started_at"]:
            return erro("Inicie o atendimento antes de concluir a ordem.")
        if not cause or not work:
            return erro("Informe a causa da falha e o serviço realizado para concluir.")
        if o["status"] == "concluída":
            return erro("Esta ordem já está concluída.")
        db.execute(
            "UPDATE service_orders SET failure_cause = ?, work_performed = ?, parts_used = ?, "
            "completed_at = ?, status = 'concluída' WHERE id = ?",
            (cause, work, parts, agora(), os_id),
        )
        msg = "Ordem concluída e histórico registrado."

    else:
        return erro("Ação inválida.")

    db.commit()
    return jsonify(mensagem=msg)


@app.post("/api/limpar")
def limpar():
    db = get_db()
    db.execute("DELETE FROM service_orders")
    db.execute("DELETE FROM equipment")
    db.execute("DELETE FROM sqlite_sequence WHERE name IN ('service_orders', 'equipment')")
    db.execute("INSERT OR REPLACE INTO config (chave, valor) VALUES ('exemplo', '0')")
    db.commit()
    return jsonify(ok=True)


init_db()

if __name__ == "__main__":
    app.run(debug=True)
