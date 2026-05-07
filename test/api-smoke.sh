#!/usr/bin/env bash
# API smoke tests — verifiserer hele stack (parsing → selectMeals → JSON)
# Bruk:
#   HOST=http://localhost:3000 ./test/api-smoke.sh         # lokal
#   HOST=https://stormat.flott.org ./test/api-smoke.sh     # prod

set -uo pipefail

HOST="${HOST:-http://localhost:3000}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

# Helper: kjør test og rapporter
check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -qE "$expected"; then
    green "  ✔ $name"
    PASS=$((PASS+1))
  else
    red "  ✘ $name"
    red "    expected pattern: $expected"
    red "    got: $(echo "$actual" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo "Tester $HOST"
echo ""

# ── Test 1: /health ──────────────────────────────────────────────────────
echo "1. Health endpoint"
res=$(curl -sf "$HOST/health" || echo "FAIL")
check "/health returnerer status:ok" '"status":"ok"' "$res"

# ── Test 2: /api/meal-plan default ───────────────────────────────────────
echo ""
echo "2. Default meal-plan (5 dager)"
res=$(curl -sf "$HOST/api/meal-plan?days=5&fishPerWeek=2&vegetarianPerWeek=1&cookTime=30&difficulty=enkel")
check "returnerer meals-array" '"meals":\[' "$res"
check "har shoppingList" '"shoppingList":\[' "$res"
check "har totalPrice" '"totalPrice":[0-9]' "$res"
check "meta.compromises eksisterer" '"compromises":' "$res"

# ── Test 3: Brukerens use case (1 dag, indisk) ──────────────────────────
echo ""
echo "3. Brukerens scenario: 1 dag + indisk (smart-bytte)"
res=$(curl -sf "$HOST/api/meal-plan?days=1&fishPerWeek=2&vegetarianPerWeek=1&cookTime=30&difficulty=enkel&likesEspecially=indisk")
check "returnerer indisk-relatert rett" 'kikertcurry|tikka|dal|paneer|curry|indisk' "$res"
check "kompromiss-melding om bytte" '"type":"preference"' "$res"
check "byttet ut fisk-melding" 'Byttet ut' "$res"

# ── Test 4: cookTime=15 + få oppskrifter passer → days-kompromiss ──────────
echo ""
echo "4. cookTime=15 stress-test"
# fishPerWeek=2 så vi får noen meals, days=5 så vi trigger days-kompromiss
res=$(curl -sf "$HOST/api/meal-plan?days=5&cookTime=15&difficulty=enkel&fishPerWeek=2&vegetarianPerWeek=1&veganPerWeek=0")
check "days-kompromiss vises" '"type":"days"' "$res"

# ── Test 5: Ukjent søkeord ────────────────────────────────────────────────
echo ""
echo "5. Ukjent søkeord (mexicansk)"
res=$(curl -sf "$HOST/api/meal-plan?days=5&likesEspecially=mexicansk&cookTime=60&difficulty=avansert")
check "preference-kompromiss" '"type":"preference"' "$res"
check "nevner databasen" 'databasen' "$res"

# ── Test 6: Verifiser at returnerte måltider respekterer cookTime ────────
echo ""
echo "6. Filter-respekt (cookTime=30)"
res=$(curl -sf "$HOST/api/meal-plan?days=5&cookTime=30&difficulty=enkel&fishPerWeek=2&vegetarianPerWeek=1")
# Sjekk at ingen returnerte har prepTime > 30
max_prep=$(echo "$res" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(max((m['prepTime'] for m in d['meals']), default=0))
")
if [ "$max_prep" -le 30 ]; then
  green "  ✔ Alle prepTime ≤ 30 (max=$max_prep)"
  PASS=$((PASS+1))
else
  red "  ✘ Fant prepTime=$max_prep > 30"
  FAIL=$((FAIL+1))
fi

# ── Test 7: Verifiser difficulty=enkel → ingen avansert ──────────────────
echo ""
echo "7. Filter-respekt (difficulty=enkel)"
res=$(curl -sf "$HOST/api/meal-plan?days=7&cookTime=60&difficulty=enkel&fishPerWeek=2&vegetarianPerWeek=1&veganPerWeek=1")
adv_count=$(echo "$res" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(sum(1 for m in d['meals'] if m['difficulty'] == 'avansert'))
")
if [ "$adv_count" -eq 0 ]; then
  green "  ✔ Ingen avansert i resultatet"
  PASS=$((PASS+1))
else
  red "  ✘ Fant $adv_count avansert-rett"
  FAIL=$((FAIL+1))
fi

# ── Oppsummering ─────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────"
echo "Resultat: $PASS passet, $FAIL feilet"
if [ "$FAIL" -gt 0 ]; then
  red "FAILED"
  exit 1
fi
green "ALL OK"
exit 0
