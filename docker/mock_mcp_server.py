from fastapi import FastAPI

app = FastAPI()

@app.get("/tools")
async def list_tools():
    return {"tools": [{"name": "test_tool", "description": "Test tool"}]}

@app.post("/tools/{tool_name}/invoke")
async def invoke_tool(tool_name: str):
    return {"result": "success", "tool_name": tool_name}

@app.get("/info")
async def info():
    return {"name": "Mock MCP Server", "version": "1.0.0"}
