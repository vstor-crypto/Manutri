-- Dados de exemplo (carregados apenas na primeira execução)

INSERT INTO equipment (code, name, sector, criticality, created_at) VALUES
  ('CMP-001', 'Compressor de parafuso',        'Utilidades', 'alta',  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-40 days')),
  ('BMB-014', 'Bomba centrífuga de processo',  'Produção',   'alta',  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-40 days')),
  ('TRF-203', 'Transformador a seco 500 kVA',  'Elétrica',   'alta',  strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-40 days')),
  ('EST-007', 'Esteira transportadora',        'Embalagem',  'média', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-40 days')),
  ('PRN-110', 'Prensa hidráulica',             'Estamparia', 'média', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-40 days'));

INSERT INTO service_orders
  (equipment_id, failure_description, priority, status, technician, opened_at, started_at, completed_at, failure_cause, work_performed, parts_used)
VALUES
  (1, 'Pressostato com leitura incorreta na linha de ar.', 'baixa', 'concluída', 'Carlos Mendes',
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-504 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-501 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-480 hours'),
   'Contatos do pressostato oxidados.', 'Limpeza dos contatos e recalibração da faixa de atuação.', ''),
  (1, 'Vibração excessiva e ruído no mancal do lado acoplado.', 'urgente', 'concluída', 'Carlos Mendes',
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-144 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-143 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-120 hours'),
   'Desgaste do rolamento por lubrificação insuficiente.', 'Substituição do rolamento, realinhamento do eixo e reposição de graxa.', 'Rolamento 6310-2RS (1 un.), graxa EP2 (0,4 kg)'),
  (5, 'Perda de pressão no circuito hidráulico durante o ciclo de prensagem.', 'média', 'concluída', 'Marcos Lima',
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-96 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-94 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-72 hours'),
   'Filtro de retorno saturado.', 'Troca do filtro de retorno e do óleo hidráulico.', 'Filtro de retorno HF-35, óleo ISO VG 46 (60 L)'),
  (2, 'Vazamento na selagem mecânica da bomba.', 'alta', 'aguardando peça', 'Paulo Ribeiro',
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-26 hours'), NULL, NULL, NULL, NULL),
  (4, 'Correia desalinhada com desgaste lateral.', 'média', 'em atendimento', 'Ana Souza',
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 hours'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours'), NULL, NULL, NULL, NULL),
  (3, 'Alarme de temperatura alta no enrolamento secundário.', 'alta', 'aberta', NULL,
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours'), NULL, NULL, NULL, NULL, NULL);

INSERT OR REPLACE INTO config (chave, valor) VALUES ('exemplo', '1');
