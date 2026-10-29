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

echo "→ Morceaux manuels de la migration 2 identiques à l'original"
if ! diff -q <(for f in "$ROOT"/supabase/manual/migration2_partie*_sur5.sql; do tail -n +3 "$f"; done) \
  "$ROOT/supabase/migrations/20261028000200_business_rules.sql" >/dev/null; then
  echo "supabase/manual/ n'est plus synchronisé avec la migration 2 : régénérez les morceaux." >&2
  exit 1
fi

echo "→ Empreintes du script d'installation à jour"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if ! grep -q "$(md5sum "$migration" | cut -c1-32)" "$ROOT/supabase/manual/installer_depuis_github.sql"; then
    echo "supabase/manual/installer_depuis_github.sql : empreinte absente pour $(basename "$migration")." >&2
    exit 1
  fi
done

echo "→ Simulation de l'environnement Supabase"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Migration $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

echo "→ Tests des permissions et des règles métier"
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/10_permissions_and_rules.sql" 2>&1 \
  | sed 's/^psql:[^ ]* NOTICE:  /  /'

echo "→ Script de vérification de l'installation (supabase/checks)"
CHECK_OUTPUT="$("${PSQL[@]}" -A -F ' | ' -P footer=off -f "$ROOT/supabase/checks/verifier_installation.sql")"
echo "$CHECK_OUTPUT" | sed 's/^/  /'
if echo "$CHECK_OUTPUT" | grep -q '❌'; then
  echo "Le script de vérification signale un problème." >&2
  exit 1
fi
