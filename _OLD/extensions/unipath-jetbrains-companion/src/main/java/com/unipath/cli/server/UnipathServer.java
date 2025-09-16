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
import org.json.JSONObject;
import org.json.JSONArray;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

@Service(Service.Level.APP)
public final class UnipathServer implements Disposable {
    private static final Logger LOG = Logger.getInstance(UnipathServer.class);
    private static final int PORT = 62325;
    private HttpServer server;
    private static UnipathServer instance;

    public UnipathServer() {
        instance = this;
        startServer();
    }

    public static UnipathServer getInstance() {
        if (instance == null) {
            instance = ApplicationManager.getApplication().getService(UnipathServer.class);
        }
        return instance;
    }

    private void startServer() {
        try {
            server = HttpServer.create(new InetSocketAddress(PORT), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            
            // Register handlers
            server.createContext("/health", new HealthHandler());
            server.createContext("/files", new FilesHandler());
            server.createContext("/file", new FileHandler());
            server.createContext("/selection", new SelectionHandler());
            server.createContext("/apply-diff", new ApplyDiffHandler());
            server.createContext("/open-file", new OpenFileHandler());
            
            server.start();
            LOG.info("UNIPATH CLI Companion server started on port " + PORT);
        } catch (IOException e) {
            LOG.error("Failed to start UNIPATH server", e);
        }
    }

    @Override
    public void dispose() {
        if (server != null) {
            server.stop(0);
            LOG.info("UNIPATH CLI Companion server stopped");
        }
    }

    private static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JSONObject response = new JSONObject();
            response.put("status", "ok");
            response.put("version", "1.0.0");
            response.put("ide", "JetBrains");
            
            sendResponse(exchange, 200, response.toString());
        }
    }

    private static class FilesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            Project project = getActiveProject();
            if (project == null) {
                sendResponse(exchange, 404, "{\"error\":\"No active project\"}");
                return;
            }

            JSONArray files = new JSONArray();
            VirtualFile[] openFiles = FileEditorManager.getInstance(project).getOpenFiles();
            
            for (VirtualFile file : openFiles) {
                JSONObject fileObj = new JSONObject();
                fileObj.put("path", file.getPath());
                fileObj.put("name", file.getName());
                fileObj.put("active", isActiveFile(project, file));
                files.put(fileObj);
            }

            JSONObject response = new JSONObject();
            response.put("files", files);
            sendResponse(exchange, 200, response.toString());
        }
    }

    private static class FileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            String query = exchange.getRequestURI().getQuery();
            if (query == null || !query.startsWith("path=")) {
                sendResponse(exchange, 400, "{\"error\":\"Missing path parameter\"}");
                return;
            }

            String path = java.net.URLDecoder.decode(query.substring(5), StandardCharsets.UTF_8);
            File file = new File(path);
            
            if (!file.exists()) {
                sendResponse(exchange, 404, "{\"error\":\"File not found\"}");
                return;
            }

            try {
                String content = new String(java.nio.file.Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
                JSONObject response = new JSONObject();
                response.put("content", content);
                response.put("path", path);
                sendResponse(exchange, 200, response.toString());
            } catch (IOException e) {
                sendResponse(exchange, 500, "{\"error\":\"Failed to read file\"}");
            }
        }
    }

    private static class SelectionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            Project project = getActiveProject();
            if (project == null) {
                sendResponse(exchange, 404, "{\"error\":\"No active project\"}");
                return;
            }

            Editor editor = FileEditorManager.getInstance(project).getSelectedTextEditor();
            if (editor == null) {
                sendResponse(exchange, 404, "{\"error\":\"No active editor\"}");
                return;
            }

            JSONObject response = new JSONObject();
            VirtualFile file = FileDocumentManager.getInstance().getFile(editor.getDocument());
            if (file != null) {
                response.put("file", file.getPath());
            }

            String selectedText = editor.getSelectionModel().getSelectedText();
            if (selectedText != null && !selectedText.isEmpty()) {
                response.put("selection", selectedText);
                response.put("hasSelection", true);
                response.put("start", editor.getSelectionModel().getSelectionStart());
                response.put("end", editor.getSelectionModel().getSelectionEnd());
            } else {
                response.put("hasSelection", false);
                response.put("cursor", editor.getCaretModel().getOffset());
            }

            sendResponse(exchange, 200, response.toString());
        }
    }

    private static class ApplyDiffHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            JSONObject request = new JSONObject(body);
            
            String filePath = request.getString("file");
            String content = request.getString("content");
            
            ApplicationManager.getApplication().invokeLater(() -> {
                ApplicationManager.getApplication().runWriteAction(() -> {
                    try {
                        File file = new File(filePath);
                        java.nio.file.Files.write(file.toPath(), content.getBytes(StandardCharsets.UTF_8));
                        
                        // Refresh the file in IDE
                        VirtualFile vFile = com.intellij.openapi.vfs.LocalFileSystem.getInstance().refreshAndFindFileByPath(filePath);
                        if (vFile != null) {
                            vFile.refresh(false, false);
                        }
                    } catch (IOException e) {
                        LOG.error("Failed to apply diff", e);
                    }
                });
            });

            sendResponse(exchange, 200, "{\"status\":\"ok\"}");
        }
    }

    private static class OpenFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
                return;
            }

            String body = readRequestBody(exchange);
            JSONObject request = new JSONObject(body);
            String filePath = request.getString("file");
            
            Project project = getActiveProject();
            if (project == null) {
                sendResponse(exchange, 404, "{\"error\":\"No active project\"}");
                return;
            }

            ApplicationManager.getApplication().invokeLater(() -> {
                VirtualFile file = com.intellij.openapi.vfs.LocalFileSystem.getInstance().findFileByPath(filePath);
                if (file != null) {
                    FileEditorManager.getInstance(project).openFile(file, true);
                }
            });

            sendResponse(exchange, 200, "{\"status\":\"ok\"}");
        }
    }

    private static void sendResponse(HttpExchange exchange, int code, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
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

    private static boolean isActiveFile(Project project, VirtualFile file) {
        Editor editor = FileEditorManager.getInstance(project).getSelectedTextEditor();
        if (editor != null) {
            Document doc = editor.getDocument();
            VirtualFile activeFile = FileDocumentManager.getInstance().getFile(doc);
            return file.equals(activeFile);
        }
        return false;
    }
}