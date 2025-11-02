import yaml
import json
from pathlib import Path
from typing import Union, Dict, Any
from server.models import ToolManifest
from pydantic import ValidationError


class ManifestParser:
    """Parser and validator for tool manifests (YAML/JSON)"""

    @staticmethod
    def parse_file(file_path: Union[str, Path]) -> ToolManifest:
        """
        Parse and validate a tool manifest from a file

        Args:
            file_path: Path to YAML or JSON manifest file

        Returns:
            Validated ToolManifest object

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file format is invalid or validation fails
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"Manifest file not found: {file_path}")

        # Read file content
        content = file_path.read_text()

        # Parse based on file extension
        if file_path.suffix in ['.yaml', '.yml']:
            data = yaml.safe_load(content)
        elif file_path.suffix == '.json':
            data = json.loads(content)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}. Use .yaml, .yml, or .json")

        return ManifestParser.parse_dict(data)

    @staticmethod
    def parse_dict(data: Dict[str, Any]) -> ToolManifest:
        """
        Parse and validate a tool manifest from a dictionary

        Args:
            data: Dictionary containing manifest data

        Returns:
            Validated ToolManifest object

        Raises:
            ValidationError: If validation fails
        """
        try:
            return ToolManifest(**data)
        except ValidationError as e:
            raise ValueError(f"Manifest validation failed: {e}")

    @staticmethod
    def parse_string(content: str, format: str = "yaml") -> ToolManifest:
        """
        Parse and validate a tool manifest from a string

        Args:
            content: String containing manifest data
            format: Format of the content ("yaml" or "json")

        Returns:
            Validated ToolManifest object

        Raises:
            ValueError: If parsing or validation fails
        """
        try:
            if format.lower() == "yaml":
                data = yaml.safe_load(content)
            elif format.lower() == "json":
                data = json.loads(content)
            else:
                raise ValueError(f"Unsupported format: {format}")

            return ManifestParser.parse_dict(data)
        except (yaml.YAMLError, json.JSONDecodeError) as e:
            raise ValueError(f"Failed to parse {format}: {e}")

    @staticmethod
    def validate_manifest(manifest: ToolManifest) -> tuple[bool, str]:
        """
        Additional validation logic for manifests

        Args:
            manifest: ToolManifest to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if path exists (basic validation)
        path = Path(manifest.path)
        if not path.exists() and not manifest.path.startswith("http"):
            return False, f"Tool path does not exist: {manifest.path}"

        # Validate timeout
        if manifest.timeout <= 0:
            return False, "Timeout must be positive"

        if manifest.timeout > 300:
            return False, "Timeout cannot exceed 300 seconds"

        return True, ""
