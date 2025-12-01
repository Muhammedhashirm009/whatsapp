# WhatsApp Bot Application

## Overview

A production-ready WhatsApp messaging bot that provides both a web interface and REST API for automated customer communications. The application uses Baileys (a WebSocket-based WhatsApp Web API) for lightweight WhatsApp integration without requiring a full browser, making it suitable for deployment on resource-constrained environments like Koyeb's free tier.

The system enables businesses to:
- Send automated WhatsApp messages programmatically via REST API
- Manage WhatsApp connections through a web dashboard
- View contacts and message history
- Integrate with PHP applications and other external systems

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Updates**: Socket.IO client for WebSocket communication

**Design Rationale**: The frontend uses a component-based architecture with shadcn/ui to provide a polished, accessible interface similar to modern messaging applications (WhatsApp Web, Telegram). React Query handles data fetching and caching efficiently, while Socket.IO enables real-time updates for connection status and incoming messages.

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP server
- **WebSocket Server**: Socket.IO for real-time bidirectional communication
- **WhatsApp Integration**: Baileys (@whiskeysockets/baileys) - a lightweight WebSocket-based library
- **Session Storage**: File-based authentication state persistence (`.sessions/baileys/`)
- **Data Storage**: In-memory storage with interface for future database integration

**Design Rationale**: Express provides a minimal, flexible HTTP layer while Socket.IO enables push notifications to connected clients. Baileys was chosen over browser-based solutions (like whatsapp-web.js with Puppeteer) to minimize memory footprint (~150MB vs ~500MB+), making it deployable on Koyeb's 512MB free tier. File-based session storage ensures WhatsApp authentication persists across restarts.

### Core Architectural Patterns

**1. Storage Abstraction Layer**
- Interface-based design (`IStorage`) allows switching between in-memory and database storage
- Currently uses `MemStorage` for development/testing
- Prepared for PostgreSQL integration via Drizzle ORM (schema defined in `shared/schema.ts`)

**2. Service Layer Pattern**
- `WhatsAppService` encapsulates all WhatsApp operations (connection, messaging, event handling)
- Handles reconnection logic, QR code generation, and session management
- Emits events via Socket.IO for client notifications

**3. API Design**
- RESTful endpoints for synchronous operations (send message, get contacts)
- WebSocket events for asynchronous updates (QR code, connection status, incoming messages)
- Validation using Zod schemas shared between client and server

**4. Type Safety**
- Shared TypeScript types between frontend and backend (`@shared/schema`)
- Drizzle ORM schema serves as single source of truth for data structures
- Zod schemas provide runtime validation aligned with TypeScript types

### Key Architectural Decisions

**WhatsApp Library Choice: Baileys vs whatsapp-web.js**
- **Problem**: Need to run WhatsApp bot on resource-constrained hosting (512MB RAM)
- **Solution**: Baileys library (WebSocket-based)
- **Alternatives**: whatsapp-web.js (Puppeteer-based browser automation)
- **Pros**: 70% lower memory usage, no browser dependencies, faster startup
- **Cons**: More sensitive to WhatsApp protocol changes, community support smaller than Puppeteer solutions

**Session Persistence Strategy**
- **Problem**: WhatsApp requires QR code re-authentication on restart
- **Solution**: File-based session storage in `.sessions/baileys/`
- **Alternatives**: Database storage, memory-only (no persistence)
- **Pros**: Simple, no database required, survives restarts
- **Cons**: Not suitable for multi-instance deployments, requires file system access

**Real-time Communication**
- **Problem**: Clients need immediate updates for QR codes and connection status
- **Solution**: Socket.IO WebSocket server
- **Alternatives**: Server-Sent Events (SSE), polling
- **Pros**: Bidirectional communication, automatic reconnection, broad browser support
- **Cons**: Slightly higher complexity than SSE

**Build Process**
- **Problem**: Need to serve both static frontend and dynamic backend APIs
- **Solution**: Vite builds frontend to `dist/public/`, esbuild bundles backend to `dist/index.js`
- **Rationale**: Single deployment artifact, Vite handles React compilation efficiently, esbuild for fast backend bundling

## Koyeb Deployment

### Environment Setup
The application uses the following environment variables for configuration:

**Required Variables:**
- `DB_HOST`: MySQL database host (e.g., 82.25.121.49)
- `DB_NAME`: MySQL database name
- `DB_USER`: MySQL database user
- `DB_PASSWORD`: MySQL database password

**Optional Variables:**
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Set to `production` for deployment

### Deployment Steps
1. Create `.env` file with database credentials (use `.env.example` as template)
2. Set Build Command: `npm run build`
3. Set Run Command: `npm start`
4. Add all environment variables in Koyeb dashboard
5. Application automatically creates database tables on first run

### Important Notes
- Application runs on port 5000 (configure in Koyeb)
- MySQL database must be accessible from Koyeb's infrastructure
- Default login credentials: admin / admin123 (change in production)
- See `KOYEB_DEPLOYMENT.md` for detailed deployment guide

## External Dependencies

### Third-party Services & APIs

**WhatsApp Integration**
- **Library**: `@whiskeysockets/baileys` (v6.7.21)
- **Purpose**: Connect to WhatsApp Web protocol without browser
- **Authentication**: QR code scanning via WhatsApp mobile app
- **Session Management**: Multi-file authentication state stored locally

### Database & ORM

**MySQL** (currently in use for production)
- **Driver**: `mysql2/promise` - Promise-based MySQL client
- **Connection Pool**: Connection pooling with 10 max connections
- **Tables**: `messages`, `contacts`, `whatsapp_session`
- **Auto-creation**: Tables are automatically created on first run
- **Hosting**: External MySQL server (e.g., 82.25.121.49)

**PostgreSQL** (prepared but not active)
- **Driver**: `@neondatabase/serverless` - WebSocket-based Postgres client
- **ORM**: Drizzle ORM (v0.39.1) with schema defined in `shared/schema.ts`
- **Note**: Database schema is fully defined with Drizzle; can be switched to Postgres if needed

### UI Component Libraries

**Radix UI Primitives**
- Comprehensive set of unstyled, accessible components
- Used for: dialogs, dropdowns, tooltips, tabs, forms, and more
- Provides keyboard navigation and ARIA attributes out-of-the-box

**Additional UI Dependencies**
- `qrcode.react`: QR code generation for WhatsApp authentication display
- `react-hook-form` + `@hookform/resolvers`: Form state management with Zod validation
- `date-fns`: Date formatting for message timestamps
- `lucide-react`: Icon library

### WebSocket & Real-time

**Socket.IO** (v4.x)
- Server: `socket.io` 
- Client: `socket.io-client`
- Used for: QR code updates, connection status, incoming message notifications

### Development Tools

**Build Tools**
- `vite`: Frontend development server and production bundler
- `esbuild`: Backend TypeScript bundling
- `tsx`: TypeScript execution for development

**Replit-specific Plugins**
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Code navigation
- `@replit/vite-plugin-dev-banner`: Development environment indicator

### Deployment Considerations

**Target Platform**: Koyeb free tier (512MB RAM, 2GB disk)
- Application designed to run within memory constraints
- No Chromium/Puppeteer dependencies
- Single-process architecture
- File-based session persistence suitable for single-instance deployments

**Environment Variables**
- `DB_HOST`: MySQL database hostname
- `DB_NAME`: MySQL database name
- `DB_USER`: MySQL database user
- `DB_PASSWORD`: MySQL database password
- `PORT`: HTTP server port (default: 5000)
- `NODE_ENV`: Runtime environment (development/production)

### Security Notes

**API Security**
- No authentication layer on REST endpoints (designed for internal network use)
- Documentation recommends securing at network/proxy level for production
- Phone number format validation to prevent injection attacks

**Session Security**
- WhatsApp session state stored in MySQL database
- Prevents auto-reconnection after manual disconnect by deleting session records
- Session data persists across server restarts for seamless reconnection on startup
- Contains sensitive WhatsApp authentication keys and tokens

**Database Credentials**
- Store credentials in environment variables only
- Never commit `.env` file to version control
- Regenerate credentials if accidentally exposed