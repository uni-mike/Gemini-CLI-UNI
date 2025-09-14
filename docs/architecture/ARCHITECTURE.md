# FlexiCLI Architecture Documentation

## System Overview

FlexiCLI is an advanced command-line interface with complete memory management, real-time monitoring, and sophisticated token economics optimized for DeepSeek R1 model.

```mermaid
graph TB
    subgraph "User Interface"
        CLI[CLI Agent]
        MON[Monitoring Dashboard]
    end
    
    subgraph "Core System"
        ORC[Orchestrator]
        MM[Memory Manager]
        TB[Token Budget]
        DS[DeepSeek Client]
    end
    
    subgraph "Memory Layers"
        EPH[Ephemeral Memory]
        RET[Retrieval System]
        EMB[Embeddings]
        KB[Knowledge Base]
    end
    
    subgraph "Storage"
        DB[(SQLite DB)]
        FS[File System]
    end
    
    CLI --> ORC
    MON --> |WebSocket| ORC
    ORC --> MM
    ORC --> DS
    MM --> TB
    MM --> EPH
    MM --> RET
    RET --> EMB
    RET --> KB
    EPH --> DB
    RET --> DB
    KB --> FS
```

## Component Architecture

### 1. Agent System

```mermaid
sequenceDiagram
    participant U as User
    participant A as Agent
    participant O as Orchestrator
    participant M as Memory
    participant D as DeepSeek
    participant T as Tools
    
    U->>A: Command
    A->>O: Process Request
    O->>M: Retrieve Context
    M-->>O: Relevant Memory
    O->>D: Generate Response
    D-->>O: AI Response
    O->>T: Execute Tools
    T-->>O: Results
    O->>M: Store Memory
    O-->>A: Final Response
    A-->>U: Display Output
```

### 2. Memory Pipeline

```mermaid
flowchart LR
    subgraph "Input Processing"
        Q[Query] --> TP[Text Processing]
        TP --> VE[Vector Embedding]
    end
    
    subgraph "Memory Retrieval"
        VE --> SS[Similarity Search]
        SS --> RC[Rank & Filter]
        RC --> TB[Token Budget Check]
    end
    
    subgraph "Context Building"
        TB --> CB[Context Builder]
        EPH[Ephemeral] --> CB
        GIT[Git Context] --> CB
        KB[Knowledge Base] --> CB
    end
    
    CB --> P[Prompt]
```

### 3. Monitoring System

```mermaid
graph TB
    subgraph "Data Collection"
        AC[Autonomous Collector]
        MC[Metrics Collector]
        EC[Event Collector]
    end
    
    subgraph "Backend API"
        WS[WebSocket Server]
        REST[REST Endpoints]
        DB[(Monitoring DB)]
    end
    
    subgraph "React Dashboard"
        DASH[Dashboard UI]
        PIPE[Pipeline View]
        MEM[Memory View]
        PERF[Performance Graphs]
    end
    
    AC --> WS
    MC --> REST
    EC --> REST
    WS --> DASH
    REST --> DASH
    DASH --> PIPE
    DASH --> MEM
    DASH --> PERF
    DB --> REST
```

## Data Flow

### Request Processing Flow

```mermaid
stateDiagram-v2
    [*] --> Input: User Command
    Input --> Validation: Parse & Validate
    Validation --> Memory: Retrieve Context
    Memory --> Planning: Build Prompt
    Planning --> Execution: Send to LLM
    Execution --> Processing: Execute Tools
    Processing --> Storage: Store Results
    Storage --> Output: Format Response
    Output --> [*]: Display to User
    
    Validation --> Error: Invalid Input
    Execution --> Error: LLM Error
    Processing --> Error: Tool Error
    Error --> [*]: Show Error
```

### Memory Lifecycle

```mermaid
flowchart TD
    subgraph "Creation"
        UC[User Command] --> CR[Create Record]
        AI[AI Response] --> CR
        TR[Tool Result] --> CR
    end
    
    subgraph "Storage"
        CR --> EMB[Generate Embedding]
        EMB --> DB[(Store in DB)]
        DB --> IDX[Update Index]
    end
    
    subgraph "Retrieval"
        Q[New Query] --> SE[Search Embeddings]
        SE --> SM[Similarity Match]
        SM --> RK[Rank Results]
        RK --> FT[Filter by Token Budget]
    end
    
    subgraph "Cleanup"
        DB --> GC[Garbage Collection]
        GC --> PR[Prune Old Records]
        PR --> CP[Compress Snapshots]
    end
```

## System Components

### Core Services

```mermaid
graph LR
    subgraph "Core Services"
        ORC[Orchestrator<br/>Main Controller]
        MM[Memory Manager<br/>Context Builder]
        TB[Token Budget<br/>Usage Tracker]
        DS[DeepSeek Client<br/>LLM Interface]
    end
    
    subgraph "Support Services"
        FS[File Service<br/>I/O Operations]
        GS[Git Service<br/>Version Control]
        PS[Project Service<br/>Configuration]
        LS[Logger Service<br/>Diagnostics]
    end
    
    ORC --> MM
    ORC --> DS
    MM --> TB
    MM --> FS
    MM --> GS
    ORC --> PS
    All --> LS
```

### Tool Registry

```mermaid
graph TD
    subgraph "Tool Categories"
        FT[File Tools<br/>Read/Write/Edit]
        ST[Shell Tools<br/>Bash/Execute]
        WT[Web Tools<br/>Search/Fetch]
        MT[Memory Tools<br/>Store/Retrieve]
    end
    
    subgraph "Tool Execution"
        TR[Tool Registry] --> VAL[Validation]
        VAL --> EXEC[Execution]
        EXEC --> RES[Result Processing]
        RES --> MEM[Memory Storage]
    end
    
    FT --> TR
    ST --> TR
    WT --> TR
    MT --> TR
```

## Deployment Architecture

### Production Setup

```mermaid
graph TB
    subgraph "Client Machine"
        AGENT[FlexiCLI Agent]
        MON[Monitoring Server]
        DASH[React Dashboard]
    end
    
    subgraph "Local Storage"
        DB[(SQLite Database)]
        PROJ[.flexicli/]
        LOGS[Logs/]
    end
    
    subgraph "External Services"
        DS[DeepSeek API]
        AZ[Azure OpenAI<br/>Embeddings]
    end
    
    AGENT --> DB
    AGENT --> PROJ
    AGENT --> DS
    AGENT --> AZ
    MON --> DB
    DASH --> MON
    AGENT --> MON
```

### Process Management

```mermaid
flowchart LR
    subgraph "Agent Process"
        AP[agent.sh] --> TSX1[npx tsx cli.tsx]
        TSX1 --> ORCH[Orchestrator]
    end
    
    subgraph "Monitoring Process"
        MP[monitoring.sh] --> TSX2[npx tsx server.ts]
        MP --> NPM[npm start]
        TSX2 --> API[API Server :4000]
        NPM --> UI[React UI :3000]
    end
    
    ORCH -.->|Events| API
    UI -.->|WebSocket| API
```

## Security Architecture

```mermaid
graph TD
    subgraph "Security Layers"
        IN[Input Validation]
        AU[API Authentication]
        SB[Sandbox Execution]
        EV[Environment Isolation]
    end
    
    subgraph "Data Protection"
        ENC[Token Encryption]
        SAN[Input Sanitization]
        LOG[Log Redaction]
        PERM[File Permissions]
    end
    
    IN --> SAN
    AU --> ENC
    SB --> EV
    EV --> PERM
    All --> LOG
```

## Performance Optimization

```mermaid
graph LR
    subgraph "Caching"
        EC[Embedding Cache]
        RC[Result Cache]
        FC[File Cache]
    end
    
    subgraph "Optimization"
        TB[Token Budgeting]
        LP[Lazy Loading]
        PS[Parallel Search]
    end
    
    subgraph "Monitoring"
        PM[Performance Metrics]
        TM[Token Monitoring]
        MM[Memory Monitoring]
    end
    
    EC --> PS
    RC --> LP
    TB --> TM
    PS --> PM
    LP --> MM
```

## Error Handling

```mermaid
stateDiagram-v2
    [*] --> Normal: Operation Start
    Normal --> Error: Exception
    Error --> Logging: Log Error
    Logging --> Recovery: Attempt Recovery
    Recovery --> Normal: Success
    Recovery --> Fallback: Failed
    Fallback --> Graceful: Graceful Degradation
    Graceful --> [*]: Continue/Exit
    
    Error --> Critical: Fatal Error
    Critical --> Shutdown: Emergency Shutdown
    Shutdown --> [*]: Exit
```

## Scalability Design

```mermaid
graph TB
    subgraph "Current (Single User)"
        SA[Single Agent]
        SM[Single Memory]
        SD[SQLite DB]
    end
    
    subgraph "Future (Multi-User)"
        MA[Multiple Agents]
        MM[Shared Memory]
        PG[(PostgreSQL)]
        CACHE[Redis Cache]
    end
    
    subgraph "Enterprise"
        LB[Load Balancer]
        CLUSTER[Agent Cluster]
        SHARD[DB Sharding]
        CDN[CDN for UI]
    end
    
    SA --> MA
    SM --> MM
    SD --> PG
    MA --> LB
    MM --> CACHE
    LB --> CLUSTER
    PG --> SHARD
```

---

*Last Updated: January 2025*
*Version: 1.0.0*