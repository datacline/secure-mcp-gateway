#!/usr/bin/env python3
"""
File Loader Tool
Loads and processes files in various formats
"""
import json
import sys
import os
import yaml
import csv


def main():
    # Get parameters from command line (passed as JSON string)
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No parameters provided"}))
        sys.exit(1)

    try:
        params = json.loads(sys.argv[1])
        file_path = params.get('file_path')
        file_format = params.get('format', 'txt')
        encoding = params.get('encoding', 'utf-8')

        if not file_path:
            print(json.dumps({"error": "Missing required parameter: file_path"}))
            sys.exit(1)

        # Check if file exists
        if not os.path.exists(file_path):
            print(json.dumps({"error": f"File not found: {file_path}"}))
            sys.exit(1)

        # Check file size limit
        max_size = int(os.getenv('MAX_FILE_SIZE', 10485760))  # 10MB default
        file_size = os.path.getsize(file_path)
        if file_size > max_size:
            print(json.dumps({"error": f"File size {file_size} exceeds limit {max_size}"}))
            sys.exit(1)

        # Load file based on format
        with open(file_path, 'r', encoding=encoding) as f:
            if file_format == 'json':
                data = json.load(f)
            elif file_format == 'yaml':
                data = yaml.safe_load(f)
            elif file_format == 'csv':
                reader = csv.DictReader(f)
                data = list(reader)
            elif file_format == 'txt':
                data = f.read()
            else:
                print(json.dumps({"error": f"Unsupported format: {file_format}"}))
                sys.exit(1)

        # Output results
        output = {
            "success": True,
            "file_path": file_path,
            "format": file_format,
            "size": file_size,
            "data": data
        }
        print(json.dumps(output, indent=2))

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON parameters: {str(e)}"}))
        sys.exit(1)
    except yaml.YAMLError as e:
        print(json.dumps({"error": f"YAML parsing error: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
