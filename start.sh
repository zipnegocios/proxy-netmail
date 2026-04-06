#!/bin/bash
set -e

echo "=========================================="
echo "Starting proxy-netmail production server"
echo "=========================================="

# Detectar directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar que existan los builds
if [ ! -d "apps/api/dist" ]; then
    echo "❌ Error: API build not found. Run 'npm run build' first."
    exit 1
fi

if [ ! -d "apps/web/.next" ]; then
    echo "❌ Error: Web build not found. Run 'npm run build' first."
    exit 1
fi

echo "✅ Builds verified"

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $API_PID $WEB_PID 2>/dev/null || true
    wait $API_PID $WEB_PID 2>/dev/null || true
    echo "Services stopped"
}
trap cleanup EXIT INT TERM

# Iniciar API en background
echo "Starting API server on port 3001..."
NODE_ENV=production PORT=3001 node apps/api/dist/server.js &
API_PID=$!

# Esperar a que API esté lista
sleep 2
if ! kill -0 $API_PID 2>/dev/null; then
    echo "❌ Error: API server failed to start"
    exit 1
fi
echo "✅ API server running (PID: $API_PID)"

# Iniciar Web en background
echo "Starting Web server on port 3000..."
cd apps/web
NODE_ENV=production PORT=3000 npx next start &
WEB_PID=$!
cd ../..

# Esperar a que Web esté lista
sleep 3
if ! kill -0 $WEB_PID 2>/dev/null; then
    echo "❌ Error: Web server failed to start"
    exit 1
fi
echo "✅ Web server running (PID: $WEB_PID)"

echo ""
echo "=========================================="
echo "All services started successfully!"
echo "- API: http://localhost:3001"
echo "- Web: http://localhost:3000"
echo "=========================================="
echo "Press Ctrl+C to stop all services"

# Mantener script corriendo
wait
