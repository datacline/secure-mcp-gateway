#!/usr/bin/env python3
"""
SQLite Reader Tool
Safely reads and queries SQLite databases
"""
import sqlite3
import json
import sys
import os


def main():
    # Get parameters from command line (passed as JSON string)
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No parameters provided"}))
        sys.exit(1)

    try:
        params = json.loads(sys.argv[1])
        database = params.get('database')
        query = params.get('query')
        limit = params.get('limit', 100)

        if not database or not query:
            print(json.dumps({"error": "Missing required parameters: database and query"}))
            sys.exit(1)

        # Check if database file exists
        if not os.path.exists(database):
            print(json.dumps({"error": f"Database file not found: {database}"}))
            sys.exit(1)

        # Safe mode: only allow SELECT queries
        if os.getenv('SQLITE_SAFE_MODE', 'true').lower() == 'true':
            if not query.strip().upper().startswith('SELECT'):
                print(json.dumps({"error": "Only SELECT queries are allowed in safe mode"}))
                sys.exit(1)

        # Connect to database (read-only)
        conn = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Execute query
        cursor.execute(query)
        rows = cursor.fetchmany(limit)

        # Convert to list of dictionaries
        results = [dict(row) for row in rows]

        # Output results
        output = {
            "success": True,
            "row_count": len(results),
            "data": results
        }
        print(json.dumps(output, indent=2))

        conn.close()

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON parameters: {str(e)}"}))
        sys.exit(1)
    except sqlite3.Error as e:
        print(json.dumps({"error": f"SQLite error: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
