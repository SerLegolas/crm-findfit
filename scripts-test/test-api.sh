#!/bin/bash
# Test delle API del CRM FindFit

API_URL="http://localhost:4000/api/v1"
TOKEN="crm_test_token_123"

echo "🧪 Testing API CRM FindFit"
echo "============================"
echo ""

# 1. Health check
echo "📊 Health Check:"
curl -s "$API_URL/../health" | jq '.'
echo ""

# 2. Autenticazione
echo "🔐 Test Login:"
curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@findfit.it","password":"admin123"}' | jq '.'
echo ""

# 3. Lista clienti
echo "📋 Lista Clienti:"
curl -s "$API_URL/clients?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 4. Crea cliente
echo "➕ Crea Cliente:"
curl -s -X POST "$API_URL/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Mario Rossi","email":"mario@example.com","phone":"3331234567"}' | jq '.'
echo ""

echo "✅ Test completati!"
