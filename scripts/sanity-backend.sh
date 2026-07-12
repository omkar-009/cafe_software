#!/usr/bin/env bash
# Backend API sanity sweep — exercises every module through the NGINX proxy.
BASE="http://localhost:5173/api/v1"
CJ=/tmp/sanity_cookies.txt
PASS=0; FAIL=0
rm -f "$CJ"
# Unique suffix so the script is idempotent (re-runnable without name collisions)
SUF="$$_$RANDOM"

# helper: check status. args: name expected method path [data] [--pub]
chk() {
  local name="$1" exp="$2" method="$3" path="$4" data="$5" pub="$6"
  local hdr=(-H "Content-Type: application/json")
  local auth=(-b "$CJ")
  [ "$pub" = "--pub" ] && auth=()
  local csrf; csrf=$(grep rs_csrf "$CJ" 2>/dev/null | awk '{print $NF}')
  [ -n "$csrf" ] && hdr+=(-H "X-CSRF-Token: $csrf")
  local code
  if [ -n "$data" ]; then
    code=$(curl -s -o /tmp/sanity_body.json -w "%{http_code}" "${auth[@]}" "${hdr[@]}" -X "$method" "$BASE$path" -d "$data")
  else
    code=$(curl -s -o /tmp/sanity_body.json -w "%{http_code}" "${auth[@]}" "${hdr[@]}" -X "$method" "$BASE$path")
  fi
  if [ "$code" = "$exp" ]; then PASS=$((PASS+1)); printf "  ✅ %-42s %s\n" "$name" "$code"
  else FAIL=$((FAIL+1)); printf "  ❌ %-42s got %s exp %s :: %s\n" "$name" "$code" "$exp" "$(head -c 120 /tmp/sanity_body.json)"; fi
}
jget() { grep -o "\"$1\":\"[^\"]*\"" /tmp/sanity_body.json | head -1 | cut -d'"' -f4; }

echo "══ AUTH ══"
chk "login (admin)" 200 POST /auth/login '{"email":"owner@demo.com","password":"Password123!","tenantSlug":"demo-cafe"}' --pub
# capture cookies from a real login with cookie jar
curl -s -c "$CJ" -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"owner@demo.com","password":"Password123!","tenantSlug":"demo-cafe"}' -o /dev/null
chk "me" 200 GET /auth/me
chk "login wrong pw → 401" 401 POST /auth/login '{"email":"owner@demo.com","password":"x","tenantSlug":"demo-cafe"}' --pub

echo "══ TENANT / BRANDING ══"
chk "get my tenant" 200 GET /tenants/me
chk "update branding" 200 PATCH /tenants/me '{"menuHeader":"Sanity header"}'

echo "══ CATEGORIES ══"
chk "list categories" 200 GET /categories
curl -s -b "$CJ" -H "Content-Type: application/json" -H "X-CSRF-Token: $(grep rs_csrf $CJ|awk '{print $NF}')" -X POST "$BASE/categories" -d '{"name":"SanityCat'"$SUF"'"}' -o /tmp/sanity_body.json
CATID=$(jget id); echo "    catId=$CATID"

echo "══ MENU ══"
chk "list menu" 200 GET /menu
curl -s -b "$CJ" -H "Content-Type: application/json" -H "X-CSRF-Token: $(grep rs_csrf $CJ|awk '{print $NF}')" -X POST "$BASE/menu" -d "{\"name\":\"SanityDish'"$SUF"'\",\"price\":100,\"categoryId\":\"$CATID\",\"variants\":[{\"name\":\"Reg\",\"priceDelta\":0,\"isDefault\":true}],\"addonGroups\":[{\"name\":\"Extras\",\"maxSelect\":2,\"options\":[{\"name\":\"Cheese\",\"price\":20}]}]}" -o /tmp/sanity_body.json
MID=$(jget id); echo "    menuItemId=$MID"
chk "get menu item (full)" 200 GET "/menu/$MID"
chk "toggle availability" 200 PATCH "/menu/$MID/toggle" '{"isOutOfStock":true}'
chk "toggle back" 200 PATCH "/menu/$MID/toggle" '{"isOutOfStock":false}'

echo "══ TABLES / QR ══"
chk "list floors" 200 GET /tables/floors
chk "list tables" 200 GET /tables
TID=$(curl -s -b "$CJ" "$BASE/tables" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
chk "get table QR" 200 GET "/tables/$TID/qr"
D=$(curl -s -b "$CJ" "$BASE/tables/$TID/qr" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | sed 's/.*d=//')

echo "══ COUPONS ══"
chk "list coupons" 200 GET /coupons

echo "══ PUBLIC (customer QR) ══"
chk "resolve QR" 200 GET "/public/resolve?d=$D" "" --pub
chk "coupon preview" 200 POST /public/coupon/preview "{\"d\":\"$D\",\"code\":\"WELCOME10\",\"subtotal\":500}" --pub
curl -s -X POST "$BASE/public/orders" -H "Content-Type: application/json" -d "{\"d\":\"$D\",\"cart\":[{\"menuItemId\":\"$MID\",\"quantity\":2,\"addonOptionIds\":[]}],\"customer\":{\"name\":\"Sanity\"}}" -o /tmp/sanity_body.json
OID=$(jget orderId); echo "    orderId=$OID"
chk "track order" 200 GET "/public/orders/$OID?d=$D" "" --pub

echo "══ ORDERS LIFECYCLE ══"
chk "list orders" 200 GET /orders
chk "kitchen queue" 200 GET /orders/kitchen/queue
chk "accept" 200 PATCH "/orders/$OID/status" '{"status":"ACCEPTED"}'
chk "preparing" 200 PATCH "/orders/$OID/status" '{"status":"PREPARING"}'
chk "ready" 200 PATCH "/orders/$OID/status" '{"status":"READY"}'
chk "serve" 200 POST "/orders/$OID/serve" ''
chk "invalid transition → 400" 400 PATCH "/orders/$OID/status" '{"status":"PENDING"}'

echo "══ BILLING ══"
chk "pay (cash)" 200 POST "/billing/orders/$OID/pay" '{"method":"CASH"}'
chk "get invoice" 200 GET "/billing/orders/$OID/invoice"
INVCODE=$(curl -s -b "$CJ" -o /tmp/inv.pdf -w "%{http_code}" "$BASE/billing/orders/$OID/invoice.pdf")
if [ "$INVCODE" = "200" ] && head -c4 /tmp/inv.pdf | grep -q "%PDF"; then PASS=$((PASS+1)); echo "  ✅ invoice PDF (valid %PDF)"; else FAIL=$((FAIL+1)); echo "  ❌ invoice PDF ($INVCODE)"; fi

echo "══ NOTIFICATIONS / AUDIT / ANALYTICS ══"
chk "notifications" 200 GET /notifications
chk "audit list" 200 GET /audit-logs
chk "audit facets" 200 GET /audit-logs/facets
chk "audit CSV export" 200 GET "/audit-logs/export?format=csv"
chk "analytics dashboard" 200 GET /analytics/dashboard
chk "sales report xlsx" 200 GET "/analytics/reports/sales?format=xlsx"

echo "══ RBAC / ISOLATION ══"
curl -s -c /tmp/kj.txt -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"kitchen@demo.com","password":"Password123!","tenantSlug":"demo-cafe"}' -o /dev/null
KCODE=$(curl -s -b /tmp/kj.txt -o /dev/null -w "%{http_code}" "$BASE/staff")
[ "$KCODE" = "403" ] && { PASS=$((PASS+1)); echo "  ✅ kitchen blocked from staff (403)"; } || { FAIL=$((FAIL+1)); echo "  ❌ kitchen staff access ($KCODE)"; }
NOCSRF=$(curl -s -b "$CJ" -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -X POST "$BASE/categories" -d '{"name":"x"}')
[ "$NOCSRF" = "403" ] && { PASS=$((PASS+1)); echo "  ✅ CSRF enforced (403)"; } || { FAIL=$((FAIL+1)); echo "  ❌ CSRF not enforced ($NOCSRF)"; }

# ── Clean up data this run created (so the menu/analytics stay tidy) ──
CS=$(grep rs_csrf "$CJ" | awk '{print $NF}')
[ -n "$MID" ] && curl -s -b "$CJ" -H "X-CSRF-Token: $CS" -X DELETE "$BASE/menu/$MID" -o /dev/null
[ -n "$CATID" ] && curl -s -b "$CJ" -H "X-CSRF-Token: $CS" -X DELETE "$BASE/categories/$CATID" -o /dev/null

echo ""
echo "════════════════════════════════"
echo "  RESULT: $PASS passed, $FAIL failed"
echo "════════════════════════════════"
