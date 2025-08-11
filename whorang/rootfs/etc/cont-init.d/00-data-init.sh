#!/command/with-contenv bash
# ==============================================================================
# Home Assistant Add-on: WhoRang - Data Initialization
# ==============================================================================

echo "Initializing data directories..."

# Create addon's data directories (ONLY modify /data - never touch /config)
mkdir -p /data/uploads /data/db

# SECURITY FIX: Only chown /data directory (addon's allocated space)
# NEVER attempt to chown /config - this violates Home Assistant security model
chown -R whorun:whorun /data

# Set proper permissions for addon data directories
chmod 755 /data
chmod 755 /data/uploads /data/db

echo "Data directories initialized successfully."
