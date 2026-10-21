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

if "${PSQL[@]}" -c "select 1 from pgmq.list_queues() where queue_name = 'console_demo'" | grep -q 1; then
  say "pgmq: demo queues already seeded"
  exit 0
fi

say "pgmq: seeding console_demo, console_demo_dlq, and console_notify"
"${PSQL[@]}" <<'SQL'
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

-- A dead letter in the shape shibuya-pgmq-adapter writes (reason fields, opt-in read_count).
SELECT pgmq.send('console_demo_dlq',
  '{"original_message":{"order_id":"ord-9"},"dead_letter_reason_code":"poison_message","dead_letter_reason_detail":"payload failed validation: total must be positive","read_count":5}');

SELECT pgmq.send('console_notify', '{"kind":"welcome","to":"ops@example.com"}');

SELECT pgmq.bind_topic('console.*', 'console_demo');
SELECT pgmq.bind_topic('console.notify.#', 'console_notify');
SQL
"${PSQL[@]}" -c "select queue_name from pgmq.list_queues() order by 1"
