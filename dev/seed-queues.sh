#!/usr/bin/env bash
# Create the console's demo queues in pgmq_dev. The pgmq schema itself is installed by the
# shibuya example consumer through pgmq-migration's pg-migrate ledger (the extension is not
# available in these clusters), so this runs as a process after the consumer is healthy.
. "$(dirname "$0")/lib.sh"

PSQL=(psql -h "$STACK_PGMQ_SOCKET_DIR" -d "$STACK_PGMQ_DATABASE" -v ON_ERROR_STOP=1 -Atq)

if ! "${PSQL[@]}" -c "select 1 from pg_namespace where nspname = 'pgmq'" | grep -q 1; then
  say "pgmq: no pgmq schema in $STACK_PGMQ_DATABASE yet; start the shibuya consumer first (just stack-up)" >&2
  exit 1
fi

if "${PSQL[@]}" -c "select 1 from pgmq.list_queues() where queue_name = 'console_demo'" | grep -q 1 &&
  ! "${PSQL[@]}" -c "select 1 from pgmq.q_console_demo_dlq where not (message ? 'dead_letter_reason')" | grep -q 1; then
  say "pgmq: demo queues already seeded"
  exit 0
fi

say "pgmq: seeding console_demo, console_demo_dlq, and console_notify"
"${PSQL[@]}" <<'SQL'
SELECT pgmq.drop_queue(q) FROM unnest(ARRAY['console_demo', 'console_demo_dlq', 'console_notify']) q
  WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = q);
SELECT pgmq.create('console_demo');
SELECT pgmq.create('console_demo_dlq');
SELECT pgmq.create('console_notify');
SELECT pgmq.enable_notify_insert('console_notify', 250);

SELECT pgmq.send('console_demo', '{"order_id":"ord-1","total":42}', '{"trace_id":"t-1","content-type":"application/json"}'::jsonb);
SELECT pgmq.send('console_demo', '{"order_id":"ord-2","total":7}', '{"trace_id":"t-2"}'::jsonb);
SELECT pgmq.send('console_demo', '{"order_id":"ord-3","total":19}');
SELECT pgmq.send('console_demo', '{"order_id":"ord-4","total":3}', 3600);
SELECT pgmq.archive('console_demo', 3::bigint);

-- Message ids are int64 and may exceed 2^53: advance the sequence past it and send one more.
SELECT setval(pg_get_serial_sequence('pgmq.q_console_demo', 'msg_id'), 9007199254740993);
SELECT pgmq.send('console_demo', '{"order_id":"ord-big","note":"id above 2^53"}');

-- A dead letter in the exact shape shibuya-pgmq-adapter writes (Shibuya/Adapter/Pgmq/Convert.hs):
-- four always-present fields plus the opt-in original metadata.
SELECT pgmq.send('console_demo_dlq',
  '{"original_message":{"order_id":"ord-9","total":-1},"dead_letter_reason":"PoisonMessage \"total must be positive\"","dead_letter_reason_code":"poison_message","dead_letter_reason_detail":{"field":"total","rule":"positive"},"original_message_id":9,"original_enqueued_at":"2026-10-21T19:00:00Z","read_count":5,"original_headers":{"trace_id":"t-9"}}');

SELECT pgmq.send('console_notify', '{"kind":"welcome","to":"ops@example.com"}');

SELECT pgmq.bind_topic('console.*', 'console_demo');
SELECT pgmq.bind_topic('console.notify.#', 'console_notify');
SQL
"${PSQL[@]}" -c "select queue_name from pgmq.list_queues() order by 1"
