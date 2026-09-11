#!/bin/bash
# 🔧 Fix import ESM/NodeNext in backend/src (aggiunge .js alle import relative)
# Nota: per Windows usa: node scripts-test/fix-imports.mjs
echo "🔧 Fixing imports in backend/src (e shared/src)..."
echo "   Su Windows esegui invece: node scripts-test/fix-imports.mjs"

# Aggiunge .js alle import relative ../... e ./... (evita di aggiungerla se già presente)
find backend/src shared/src -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -exec sed -i -E "s/(from[[:space:]]+['\"])(\.\.?\/[^'\"]*[^./'\"])(['\"])/\1\2.js\3/g; s/(import[[:space:]]*\([[:space:]]*['\"])(\.\.?\/[^'\"]*[^./'\"])(['\"])/\1\2.js\3/g" {} +

echo "✅ Done!"
