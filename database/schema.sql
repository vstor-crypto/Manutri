-- Manutri · Gestão e Controle da Manutenção Industrial
-- Banco: SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS equipment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE COLLATE NOCASE,        -- TAG única (sem diferenciar maiúsculas/minúsculas)
    name        TEXT NOT NULL,
    sector      TEXT NOT NULL,
    criticality TEXT NOT NULL CHECK (criticality IN ('baixa', 'média', 'alta')),
    created_at  TEXT NOT NULL
);

-- id autoincrement = numeração sequencial (exibida como OS-00001)
CREATE TABLE IF NOT EXISTS service_orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id        INTEGER NOT NULL REFERENCES equipment(id),
    failure_description TEXT NOT NULL,
    priority            TEXT NOT NULL CHECK (priority IN ('baixa', 'média', 'alta', 'urgente')),
    status              TEXT NOT NULL DEFAULT 'aberta'
                        CHECK (status IN ('aberta', 'em atendimento', 'aguardando peça', 'concluída')),
    technician          TEXT,
    opened_at           TEXT NOT NULL,
    started_at          TEXT,
    completed_at        TEXT,
    failure_cause       TEXT,
    work_performed      TEXT,
    parts_used          TEXT,

    -- Início do atendimento exige técnico responsável
    CHECK (started_at IS NULL OR (technician IS NOT NULL AND technician <> '')),
    -- Só muda de situação depois de iniciar
    CHECK (status = 'aberta' OR started_at IS NOT NULL),
    -- Conclusão exige causa e serviço realizado (peças são opcionais)
    CHECK (status <> 'concluída' OR (
        completed_at IS NOT NULL
        AND failure_cause IS NOT NULL AND failure_cause <> ''
        AND work_performed IS NOT NULL AND work_performed <> ''
    ))
);

CREATE INDEX IF NOT EXISTS idx_os_equipment ON service_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_os_status    ON service_orders(status);

-- Ordem concluída não pode ser reaberta nem alterada
CREATE TRIGGER IF NOT EXISTS trg_os_concluida_imutavel
BEFORE UPDATE ON service_orders
WHEN OLD.status = 'concluída'
BEGIN
    SELECT RAISE(ABORT, 'Uma ordem concluída não pode ser reaberta nem alterada.');
END;

-- A data de início é gravada uma única vez
CREATE TRIGGER IF NOT EXISTS trg_os_inicio_unico
BEFORE UPDATE OF started_at ON service_orders
WHEN OLD.started_at IS NOT NULL AND NEW.started_at IS NOT OLD.started_at
BEGIN
    SELECT RAISE(ABORT, 'A data de início do atendimento já foi gravada.');
END;

CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
