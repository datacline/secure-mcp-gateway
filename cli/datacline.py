#!/usr/bin/env python3
"""
Datacline CLI - Secure MCP Gateway Management Tool
"""
import click
import httpx
import json
import yaml
import subprocess
import sys
from pathlib import Path
from typing import Optional


API_BASE_URL = "http://localhost:8000"


@click.group()
def cli():
    """Datacline CLI - Manage MCP Gateway"""
    pass


@cli.command()
@click.option('--host', default='0.0.0.0', help='Host to bind to')
@click.option('--port', default=8000, help='Port to listen on')
@click.option('--reload', is_flag=True, help='Enable auto-reload for development')
@click.option('--auth/--no-auth', default=True, help='Enable/disable authentication')
def serve(host: str, port: int, reload: bool, auth: bool):
    """Start the MCP Gateway server"""
    click.echo(click.style("🚀 Starting Secure MCP Gateway...", fg='green'))

    # Set environment variables
    import os
    os.environ['HOST'] = host
    os.environ['PORT'] = str(port)
    os.environ['AUTH_ENABLED'] = str(auth).lower()

    try:
        # Run uvicorn
        cmd = [
            sys.executable, '-m', 'uvicorn',
            'server.main:app',
            '--host', host,
            '--port', str(port)
        ]

        if reload:
            cmd.append('--reload')

        click.echo(f"Server starting at http://{host}:{port}")
        click.echo(f"Auth enabled: {auth}")
        click.echo(f"API docs: http://{host}:{port}/docs")
        click.echo("")

        subprocess.run(cmd)

    except KeyboardInterrupt:
        click.echo("\n👋 Shutting down gateway...")
    except Exception as e:
        click.echo(click.style(f"✗ Error starting server: {str(e)}", fg='red'))
        sys.exit(1)


@cli.command('register-mcp')
@click.argument('name')
@click.argument('url')
@click.option('--type', 'server_type', default='http', help='Server type (http, grpc)')
@click.option('--timeout', default=30, help='Request timeout in seconds')
@click.option('--enabled/--disabled', default=True, help='Enable/disable server')
def register_mcp(name: str, url: str, server_type: str, timeout: int, enabled: bool):
    """Register an MCP server in the configuration"""
    try:
        config_file = Path('mcp_servers.yaml')

        # Load existing configuration
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f) or {}
        else:
            config = {}

        if 'servers' not in config:
            config['servers'] = {}

        # Add server configuration
        config['servers'][name] = {
            'url': url,
            'type': server_type,
            'timeout': timeout,
            'enabled': enabled
        }

        # Save configuration
        with open(config_file, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)

        click.echo(click.style(f"✓ MCP server '{name}' registered successfully", fg='green'))
        click.echo(f"URL: {url}")
        click.echo(f"Type: {server_type}")
        click.echo(f"Enabled: {enabled}")

    except Exception as e:
        click.echo(click.style(f"✗ Error: {str(e)}", fg='red'))
        sys.exit(1)


@cli.command('list-servers')
@click.option('--token', help='JWT access token')
@click.option('--api-url', default=API_BASE_URL, help='API base URL')
def list_servers(token: Optional[str], api_url: str):
    """List configured MCP servers"""
    try:
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        with httpx.Client() as client:
            response = client.get(
                f"{api_url}/mcp/servers",
                headers=headers
            )

            if response.status_code == 200:
                result = response.json()
                servers = result.get('servers', [])

                if not servers:
                    click.echo("No MCP servers configured")
                    return

                click.echo(f"{'Name':<20} {'URL':<40} {'Type':<10} {'Enabled':<10}")
                click.echo("-" * 85)
                for server in servers:
                    enabled = '✓' if server['enabled'] else '✗'
                    click.echo(f"{server['name']:<20} {server['url']:<40} {server['type']:<10} {enabled:<10}")

                click.echo(f"\nTotal: {len(servers)} server(s)")

            else:
                error = response.json().get('detail', 'Unknown error')
                click.echo(click.style(f"✗ Failed to list servers: {error}", fg='red'))
                sys.exit(1)

    except Exception as e:
        click.echo(click.style(f"✗ Error: {str(e)}", fg='red'))
        sys.exit(1)


@cli.command('list-tools')
@click.argument('mcp_server')
@click.option('--token', help='JWT access token')
@click.option('--api-url', default=API_BASE_URL, help='API base URL')
@click.option('--format', type=click.Choice(['table', 'json']), default='table', help='Output format')
def list_tools(mcp_server: str, token: Optional[str], api_url: str, format: str):
    """List tools from an MCP server"""
    try:
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        with httpx.Client() as client:
            response = client.get(
                f"{api_url}/mcp/list-tools",
                params={'mcp_server': mcp_server},
                headers=headers
            )

            if response.status_code == 200:
                result = response.json()
                tools = result.get('tools', [])

                if format == 'json':
                    click.echo(json.dumps(result, indent=2))
                else:
                    if not tools:
                        click.echo(f"No tools found on server '{mcp_server}'")
                        return

                    click.echo(f"Tools on MCP server: {mcp_server}")
                    click.echo(f"{'Name':<30} {'Description':<50}")
                    click.echo("-" * 85)
                    for tool in tools:
                        desc = (tool.get('description', '')[:47] + '...') if len(tool.get('description', '')) > 50 else tool.get('description', '')
                        click.echo(f"{tool.get('name', ''):<30} {desc:<50}")

                    click.echo(f"\nTotal: {len(tools)} tool(s)")

            else:
                error = response.json().get('detail', 'Unknown error')
                click.echo(click.style(f"✗ Failed to list tools: {error}", fg='red'))
                sys.exit(1)

    except Exception as e:
        click.echo(click.style(f"✗ Error: {str(e)}", fg='red'))
        sys.exit(1)


@cli.command()
@click.argument('mcp_server')
@click.argument('tool_name')
@click.option('--params', '-p', help='Tool parameters as JSON string')
@click.option('--params-file', type=click.Path(exists=True), help='Tool parameters from JSON file')
@click.option('--token', help='JWT access token')
@click.option('--api-url', default=API_BASE_URL, help='API base URL')
def invoke(mcp_server: str, tool_name: str, params: Optional[str], params_file: Optional[str],
           token: Optional[str], api_url: str):
    """Invoke a tool on an MCP server"""
    try:
        # Parse parameters
        parameters = None
        if params_file:
            with open(params_file, 'r') as f:
                parameters = json.load(f)
        elif params:
            parameters = json.loads(params)

        # Prepare headers
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        # Send invocation request
        with httpx.Client(timeout=300.0) as client:
            response = client.post(
                f"{api_url}/mcp/invoke",
                params={'mcp_server': mcp_server},
                json={
                    "tool_name": tool_name,
                    "parameters": parameters
                },
                headers=headers
            )

            if response.status_code == 200:
                result = response.json()

                if result.get('success'):
                    click.echo(click.style(f"✓ Tool '{tool_name}' executed successfully on '{mcp_server}'", fg='green'))

                    if result.get('execution_time_ms'):
                        click.echo(f"Execution time: {result['execution_time_ms']}ms")

                    if result.get('result'):
                        click.echo("\nResult:")
                        click.echo(json.dumps(result['result'], indent=2))
                else:
                    click.echo(click.style(f"✗ Tool execution failed", fg='red'))
                    if result.get('error'):
                        click.echo(f"Error: {result['error']}")
                    sys.exit(1)

            else:
                error = response.json().get('detail', 'Unknown error')
                click.echo(click.style(f"✗ Invocation failed: {error}", fg='red'))
                sys.exit(1)

    except json.JSONDecodeError:
        click.echo(click.style("✗ Invalid JSON in parameters", fg='red'))
        sys.exit(1)
    except Exception as e:
        click.echo(click.style(f"✗ Error: {str(e)}", fg='red'))
        sys.exit(1)


if __name__ == '__main__':
    cli()
