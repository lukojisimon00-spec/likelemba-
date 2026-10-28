#!/usr/bin/env bash
# Applique les migrations sur un PostgreSQL local jetable, puis lance les tests
# de permissions. Nécessite PostgreSQL 15+ installé (initdb, pg_ctl, psql).
# Aucun projet Supabase réel n'est touché.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="${PG_BIN}:${PATH}"

if ! command -v initdb >/dev/null 2>&1; then
  echo "PostgreSQL (initdb) est introuvable. Installez PostgreSQL ou définissez PG_BIN." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL refuse de démarrer en tant que root.
  chown -R postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() {
  "${RUN_AS[@]}" pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("${RUN_AS[@]}" psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)

echo "→ Simulation de l'environnement Supabase"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Migration $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

echo "→ Tests des permissions et des règles métier"
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/10_permissions_and_rules.sql" 2>&1 \
  | sed 's/^psql:[^ ]* NOTICE:  /  /'
