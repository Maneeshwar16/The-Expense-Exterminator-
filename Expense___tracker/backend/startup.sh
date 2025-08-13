#!/bin/bash
set -e

# Run the database initialization command
flask init-db

# Start the web server
gunicorn app:app