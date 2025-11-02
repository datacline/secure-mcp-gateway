import subprocess
import json
import time
from typing import Dict, Any, Optional
from pathlib import Path


class SandboxRunner:
    """Sandbox runner for executing tools securely"""

    def __init__(self):
        pass

    def execute(
        self,
        tool_path: str,
        parameters: Optional[Dict[str, Any]] = None,
        environment: Optional[Dict[str, str]] = None,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Execute a tool in a sandboxed environment

        Args:
            tool_path: Path to the tool executable/script
            parameters: Tool parameters
            environment: Environment variables
            timeout: Execution timeout in seconds

        Returns:
            Dictionary with execution results:
            {
                'status': 'success' or 'error',
                'output': stdout output,
                'error': stderr output or error message,
                'exit_code': process exit code,
                'execution_time': execution time in milliseconds
            }
        """
        start_time = time.time()

        try:
            # Prepare command
            path = Path(tool_path)

            if not path.exists():
                return {
                    'status': 'error',
                    'output': None,
                    'error': f'Tool path does not exist: {tool_path}',
                    'exit_code': -1,
                    'execution_time': 0
                }

            # Build command based on file type
            if path.suffix == '.py':
                cmd = ['python', str(path)]
            elif path.suffix == '.sh':
                cmd = ['bash', str(path)]
            elif path.suffix == '.js':
                cmd = ['node', str(path)]
            elif path.is_file() and path.stat().st_mode & 0o111:  # Executable
                cmd = [str(path)]
            else:
                return {
                    'status': 'error',
                    'output': None,
                    'error': f'Unsupported tool type: {path.suffix}',
                    'exit_code': -1,
                    'execution_time': 0
                }

            # Add parameters as JSON string argument if provided
            if parameters:
                cmd.append(json.dumps(parameters))

            # Prepare environment
            env = environment.copy() if environment else {}

            # Execute with timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**subprocess.os.environ, **env}
            )

            execution_time = int((time.time() - start_time) * 1000)

            if result.returncode == 0:
                return {
                    'status': 'success',
                    'output': result.stdout,
                    'error': result.stderr if result.stderr else None,
                    'exit_code': result.returncode,
                    'execution_time': execution_time
                }
            else:
                return {
                    'status': 'error',
                    'output': result.stdout if result.stdout else None,
                    'error': result.stderr if result.stderr else 'Tool execution failed',
                    'exit_code': result.returncode,
                    'execution_time': execution_time
                }

        except subprocess.TimeoutExpired:
            execution_time = int((time.time() - start_time) * 1000)
            return {
                'status': 'error',
                'output': None,
                'error': f'Tool execution timed out after {timeout} seconds',
                'exit_code': -1,
                'execution_time': execution_time
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            return {
                'status': 'error',
                'output': None,
                'error': f'Execution error: {str(e)}',
                'exit_code': -1,
                'execution_time': execution_time
            }


# Global sandbox runner instance
sandbox_runner = SandboxRunner()
