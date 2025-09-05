#!/bin/sh

# SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
# SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
# SPDX-License-Identifier: MIT

set -e

# Get delay from first argument or use default of 0 minutes (no delay)
DELAY_IN_MINUTES=${1:-0}

# Convert minutes to seconds
DELAY_IN_SECONDS=$((DELAY_IN_MINUTES * 60))

START_DATETIME=$(date "+%Y-%m-%d %H:%M:%S")

echo "Starting update at ${START_DATETIME}"
# Run the update command
yarn job:import-from-inner-identifiers
yarn job:import-cnll-sill-only
yarn job:update

END_DATETIME=$(date "+%Y-%m-%d %H:%M:%S")

# Always wait for the specified delay before exiting
# This will cause Docker to wait before restarting the container
echo "Update completed at ${END_DATETIME}, waiting the delay of ${DELAY_IN_MINUTES} minutes before quitting"
sleep ${DELAY_IN_SECONDS}

exit 0

