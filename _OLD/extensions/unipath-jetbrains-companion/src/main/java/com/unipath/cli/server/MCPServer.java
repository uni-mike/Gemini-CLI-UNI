package com.unipath.cli.server;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.fileEditor.FileEditorManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.project.ProjectManager;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.Headers;
import org.json.JSONObject;
import org.json.JSONArray;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Timer;
import java.util.TimerTask;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service(Service.Level.APP)
public final class MCPServer implements Disposable {
    private static final Logger LOG = Logger.getInstance(MCPServer.class);
    private static final int PORT = 62325;
    private HttpServer server;
    private static MCPServer instance;
    private final Map<String, MCPSession> sessions = new ConcurrentHashMap<>();
    private Timer keepAliveTimer;

    public MCPServer() {
        instance = this;
        startServer();
        writePortFile();
        startKeepAlive();
    }

    public static MCPServer getInstance() {
        if (instance == null) {
            instance = ApplicationManager.getApplication().getService(MCPServer.class);
        }
        return instance;
    }

    private void writePortFile() {
        try {
            String tmpDir = System.getProperty("java.io.tmpdir");
            String ppid = getParentProcessId();
            if (ppid != null) {
                Path portFile = Paths.get(tmpDir, "gemini-ide-server-" + ppid + ".json");
                JSONObject config = new JSONObject();
                config.put("port", PORT);
                
                // Get workspace path from the first open project
                Project[] projects = ProjectManager.getInstance().getOpenProjects();
                if (projects.length > 0) {
                    String basePath = projects[0].getBasePath();
                    if (basePath != null) {
                        config.put("workspacePath", basePath);
                    }
                }
                
                Files.writeString(portFile, config.toString());
                LOG.info("Wrote port file: " + portFile);
            }
        } catch (Exception e) {
            LOG.error("Failed to write port file", e);
        }
    }

    private String getParentProcessId() {
        try {
            // Try to get parent process ID (this is platform-dependent)
            String pid = String.valueOf(ProcessHandle.current().pid());
            ProcessHandle parent = ProcessHandle.current().parent().orElse(null);
            if (parent != null) {
                return String.valueOf(parent.pid());
            }
            return pid;
        } catch (Exception e) {
            LOG.warn("Could not get parent process ID", e);
            return null;
        }
    }

    private void startKeepAlive() {
        keepAliveTimer = new Timer(true);
        keepAliveTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                sessions.forEach((id, session) -> {
                    try {
                        session.sendPing();
                    } catch (Exception e) {
                        LOG.debug("Failed to send ping to session " + id);
                        sessions.remove(id);
                    }
                });
            }
        }, 60000, 60000); // Every 60 seconds
    }

    private void startServer() {
        try {
            server = HttpServer.create(new InetSocketAddress(PORT), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            
            // MCP endpoint
            server.createContext("/mcp", new MCPHandler());
            
            // Legacy endpoints for compatibility
            server.createContext("/health", new HealthHandler());
            
            server.start();
            LOG.info("UNIPATH MCP Server started on port " + PORT);
        } catch (IOException e) {
            LOG.error("Failed to start MCP server", e);
        }
    }

    @Override
    public void dispose() {
        if (keepAliveTimer != null) {
            keepAliveTimer.cancel();
        }
        if (server != null) {
            server.stop(0);
            LOG.info("UNIPATH MCP Server stopped");
        }
    }

    private class MCPHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Handle CORS preflight
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, -32000, "Method not allowed");
                return;
            }

            String sessionId = exchange.getRequestHeaders().getFirst("mcp-session-id");
            String body = readRequestBody(exchange);
            JSONObject request = new JSONObject(body);

            // Check if this is an initialize request
            if (isInitializeRequest(request)) {
                if (sessionId != null) {
                    sendError(exchange, 400, -32000, "Session ID should not be provided for initialize request");
                    return;
                }
                
                // Create new session
                final String finalSessionId = UUID.randomUUID().toString();
                MCPSession session = new MCPSession(finalSessionId);
                sessions.put(finalSessionId, session);
                
                // Create a thread to handle SSE connection
                Thread sseThread = new Thread(() -> {
                    try {
                        // Send initialize response with SSE headers
                        Headers headers = exchange.getResponseHeaders();
                        headers.set("Content-Type", "text/event-stream");
                        headers.set("Cache-Control", "no-cache");
                        headers.set("Connection", "keep-alive");
                        headers.set("Access-Control-Allow-Origin", "*");
                        headers.set("mcp-session-id", finalSessionId);
                        
                        JSONObject response = createInitializeResponse(request);
                        String sseData = "data: " + response.toString() + "\n\n";
                        
                        exchange.sendResponseHeaders(200, 0);
                        OutputStream os = exchange.getResponseBody();
                        os.write(sseData.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                        
                        // Send initial context update
                        session.sendContextUpdate(os);
                        
                        // Keep connection open for SSE
                        session.setOutputStream(os);
                        
                        LOG.info("MCP session initialized: " + finalSessionId);
                        
                        // Keep the connection alive
                        while (sessions.containsKey(finalSessionId)) {
                            Thread.sleep(30000); // Sleep for 30 seconds
                            if (sessions.containsKey(finalSessionId)) {
                                session.sendPing();
                            }
                        }
                    } catch (Exception e) {
                        LOG.error("SSE connection error", e);
                        sessions.remove(finalSessionId);
                    } finally {
                        try {
                            exchange.getResponseBody().close();
                        } catch (IOException e) {
                            // Ignore
                        }
                    }
                });
                sseThread.setDaemon(true);
                sseThread.start();
                return;
            } else {
                // Handle other requests
                if (sessionId == null || !sessions.containsKey(sessionId)) {
                    sendError(exchange, 400, -32000, "Invalid or missing session ID");
                    return;
                }
                
                MCPSession session = sessions.get(sessionId);
                handleRequest(exchange, session, request);
            }
        }

        private boolean isInitializeRequest(JSONObject request) {
            return "initialize".equals(request.optString("method"));
        }

        private JSONObject createInitializeResponse(JSONObject request) {
            JSONObject response = new JSONObject();
            response.put("jsonrpc", "2.0");
            response.put("id", request.get("id"));
            
            JSONObject result = new JSONObject();
            result.put("protocolVersion", "1.0.0");
            
            JSONObject serverInfo = new JSONObject();
            serverInfo.put("name", "unipath-jetbrains-mcp-server");
            serverInfo.put("version", "1.0.0");
            result.put("serverInfo", serverInfo);
            
            JSONObject capabilities = new JSONObject();
            capabilities.put("logging", new JSONObject());
            
            JSONObject tools = new JSONObject();
            tools.put("listChanged", true);
            capabilities.put("tools", tools);
            
            result.put("capabilities", capabilities);
            response.put("result", result);
            
            return response;
        }

        private void handleRequest(HttpExchange exchange, MCPSession session, JSONObject request) throws IOException {
            String method = request.optString("method");
            
            JSONObject response = new JSONObject();
            response.put("jsonrpc", "2.0");
            if (request.has("id")) {
                response.put("id", request.get("id"));
            }
            
            switch (method) {
                case "tools/list":
                    response.put("result", getToolsList());
                    break;
                    
                case "tools/call":
                    JSONObject params = request.getJSONObject("params");
                    String toolName = params.getString("name");
                    JSONObject arguments = params.optJSONObject("arguments");
                    response.put("result", callTool(toolName, arguments));
                    break;
                    
                case "ping":
                    // Ping doesn't need a response
                    exchange.sendResponseHeaders(200, 0);
                    exchange.getResponseBody().close();
                    return;
                    
                default:
                    sendError(exchange, 400, -32601, "Method not found: " + method);
                    return;
            }
            
            sendResponse(exchange, 200, response.toString());
        }

        private JSONObject getToolsList() {
            JSONObject result = new JSONObject();
            JSONArray tools = new JSONArray();
            
            // openDiff tool
            JSONObject openDiff = new JSONObject();
            openDiff.put("name", "openDiff");
            openDiff.put("description", "(IDE Tool) Open a diff view to create or modify a file");
            
            JSONObject openDiffSchema = new JSONObject();
            openDiffSchema.put("type", "object");
            JSONObject openDiffProps = new JSONObject();
            openDiffProps.put("filePath", new JSONObject().put("type", "string"));
            openDiffProps.put("newContent", new JSONObject().put("type", "string"));
            openDiffSchema.put("properties", openDiffProps);
            openDiffSchema.put("required", new JSONArray().put("filePath"));
            
            openDiff.put("inputSchema", openDiffSchema);
            tools.put(openDiff);
            
            // closeDiff tool
            JSONObject closeDiff = new JSONObject();
            closeDiff.put("name", "closeDiff");
            closeDiff.put("description", "(IDE Tool) Close an open diff view for a specific file");
            
            JSONObject closeDiffSchema = new JSONObject();
            closeDiffSchema.put("type", "object");
            JSONObject closeDiffProps = new JSONObject();
            closeDiffProps.put("filePath", new JSONObject().put("type", "string"));
            closeDiffProps.put("suppressNotification", new JSONObject().put("type", "boolean"));
            closeDiffSchema.put("properties", closeDiffProps);
            closeDiffSchema.put("required", new JSONArray().put("filePath"));
            
            closeDiff.put("inputSchema", closeDiffSchema);
            tools.put(closeDiff);
            
            result.put("tools", tools);
            return result;
        }

        private JSONObject callTool(String toolName, JSONObject arguments) {
            JSONObject result = new JSONObject();
            JSONArray content = new JSONArray();
            JSONObject textContent = new JSONObject();
            
            switch (toolName) {
                case "openDiff":
                    String filePath = arguments.getString("filePath");
                    String newContent = arguments.optString("newContent", "");
                    // TODO: Implement actual diff showing in IDE
                    textContent.put("type", "text");
                    textContent.put("text", "Showing diff for " + filePath);
                    break;
                    
                case "closeDiff":
                    String fileToClose = arguments.getString("filePath");
                    // TODO: Implement actual diff closing in IDE
                    textContent.put("type", "text");
                    textContent.put("text", "Closed diff for " + fileToClose);
                    break;
                    
                default:
                    textContent.put("type", "text");
                    textContent.put("text", "Unknown tool: " + toolName);
            }
            
            content.put(textContent);
            result.put("content", content);
            return result;
        }
    }

    private class MCPSession {
        private final String id;
        private OutputStream outputStream;
        
        MCPSession(String id) {
            this.id = id;
        }
        
        void setOutputStream(OutputStream os) {
            this.outputStream = os;
        }
        
        void sendPing() throws IOException {
            if (outputStream != null) {
                JSONObject ping = new JSONObject();
                ping.put("jsonrpc", "2.0");
                ping.put("method", "ping");
                
                String sseData = "data: " + ping.toString() + "\n\n";
                outputStream.write(sseData.getBytes(StandardCharsets.UTF_8));
                outputStream.flush();
            }
        }
        
        void sendContextUpdate(OutputStream os) throws IOException {
            JSONObject notification = new JSONObject();
            notification.put("jsonrpc", "2.0");
            notification.put("method", "ide/contextUpdate");
            
            JSONObject params = new JSONObject();
            
            // Add open files
            JSONArray openFiles = new JSONArray();
            Project project = getActiveProject();
            if (project != null) {
                VirtualFile[] files = FileEditorManager.getInstance(project).getOpenFiles();
                for (VirtualFile file : files) {
                    JSONObject fileInfo = new JSONObject();
                    fileInfo.put("uri", "file://" + file.getPath());
                    fileInfo.put("name", file.getName());
                    openFiles.put(fileInfo);
                }
            }
            params.put("openFiles", openFiles);
            
            // Add workspace state
            JSONObject workspaceState = new JSONObject();
            workspaceState.put("isTrusted", true);
            params.put("workspaceState", workspaceState);
            
            notification.put("params", params);
            
            String sseData = "data: " + notification.toString() + "\n\n";
            os.write(sseData.getBytes(StandardCharsets.UTF_8));
            os.flush();
        }
    }

    private static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONObject response = new JSONObject();
            response.put("status", "ok");
            response.put("version", "1.0.0");
            response.put("ide", "JetBrains");
            response.put("mcp", true);
            
            sendResponse(exchange, 200, response.toString());
        }
    }

    private static void sendResponse(HttpExchange exchange, int code, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
        
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    private static void sendError(HttpExchange exchange, int httpCode, int errorCode, String message) throws IOException {
        JSONObject response = new JSONObject();
        response.put("jsonrpc", "2.0");
        
        JSONObject error = new JSONObject();
        error.put("code", errorCode);
        error.put("message", message);
        response.put("error", error);
        response.put("id", JSONObject.NULL);
        
        sendResponse(exchange, httpCode, response.toString());
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8);
        BufferedReader br = new BufferedReader(isr);
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }
        br.close();
        return sb.toString();
    }

    private static Project getActiveProject() {
        Project[] projects = ProjectManager.getInstance().getOpenProjects();
        if (projects.length > 0) {
            return projects[0];
        }
        return null;
    }
}