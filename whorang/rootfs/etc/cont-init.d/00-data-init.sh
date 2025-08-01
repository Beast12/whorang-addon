#!/command/with-contenv bash
# ==============================================================================
# Home Assistant Add-on: WhoRang - Data Initialization
# ==============================================================================

echo "Initializing data directories..."

mkdir -p /data/uploads /data/db /config

# Ensure the 'whorun' user owns the data and config directories
chown -R whorun:whorun /data /config

echo "Data directories initialized successfully."
