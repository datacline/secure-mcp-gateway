# Fix: NullPointerException in Tool Calls

## Problem

When VS Code called a tool, the gateway crashed with:

```
java.lang.NullPointerException: Cannot invoke "java.lang.Boolean.booleanValue()" 
because the return value of "io.modelcontextprotocol.spec.McpSchema$CallToolResult.isError()" is null
```

## Root Cause

The MCP SDK's `CallToolResult.isError()` method can return `null` (not just `true` or `false`).

When the code tried to unbox this nullable `Boolean` to a primitive `boolean`, it threw a `NullPointerException`.

## The Fix

**Before:**
```java
out.put("isError", r != null && r.isError());
```

This fails when `r.isError()` returns `null` because Java tries to unbox it to `boolean`.

**After:**
```java
out.put("isError", r != null && r.isError() != null && r.isError());
```

Now we check if `isError()` is not null before unboxing. If it's `null`, we treat it as `false`.

## File Changed

- `McpHttpClient.java` line 260

## Testing

Restart the gateway and try calling a tool from VS Code:

```bash
cd server-java
./mvnw spring-boot:run
```

The tool should execute without crashing now.

## Why This Happened

The MCP Java SDK models fields as nullable `Boolean` objects (not primitive `boolean`), following the JSON-RPC spec where fields can be omitted/null.

This is common in API responses where:
- `"isError": true` → Error occurred
- `"isError": false` → No error
- `"isError": null` or field omitted → No error (default)

## Status

✅ Fixed  
✅ Compiled successfully  
✅ Ready to test with VS Code
