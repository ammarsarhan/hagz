# Hagz

A scalable B2B2C web application for real-time football pitch booking, demonstrating full-stack development capabilities with modern technologies and production-ready architecture.

## Overview

Hagz is a comprehensive booking platform that connects football pitch owners with players, enabling real-time reservations, availability management, and location-based search. The application showcases proficiency in building complex, multi-tenant systems with microservices architecture, geospatial features, and asynchronous processing.

## Key Technical Implementations

### Real-time Booking System
Implemented a thread-safe, concurrent booking system handling race conditions and preventing double-bookings through optimistic locking and database transactions.

### Geospatial Search with PostGIS
Leveraged PostGIS spatial extensions to build efficient location-based queries, calculating distances and implementing radius-based search functionality for finding nearby pitches.

### Asynchronous Job Processing
Architected background job processing using BullMQ and Redis for handling booking confirmations, notifications, and scheduled tasks, demonstrating understanding of distributed systems and queue-based architectures.

### Type-Safe Development
Utilized TypeScript across the entire stack with Prisma ORM for end-to-end type safety, reducing runtime errors and improving maintainability.

### Scalable Architecture
Designed with separation of concerns, implementing RESTful API principles, middleware patterns, and modular component architecture for maintainability and scalability.

## Technical Stack

### Frontend
- **Next.js** - Server-side rendering and static generation for optimal performance
- **TypeScript** - Static typing for improved code quality and developer experience
- **Tailwind CSS** - Utility-first styling with responsive design principles

### Backend
- **Express.js** - RESTful API development with middleware architecture
- **Prisma ORM** - Type-safe database access with migrations and query optimization
- **PostgreSQL** - Relational database management with ACID compliance
- **PostGIS** - Spatial database extension for geolocation features
- **Redis** - In-memory caching and session management
- **BullMQ** - Distributed job queue for asynchronous task processing

## Architecture Highlights

**Multi-tenant B2B2C Model**: Implemented role-based access control (RBAC) supporting venue owners, staff, and customers with isolated data access patterns.

**Performance Optimization**: Utilized Redis caching strategies, database indexing, and query optimization to handle high-traffic scenarios.

**Security Implementation**: JWT-based authentication, input validation, SQL injection prevention through parameterized queries, and XSS protection.

## Prerequisites

- Node.js v18+
- PostgreSQL v14+ with PostGIS extension
- Redis v6+
- npm or yarn package manager

## Installation and Setup

### Clone Repository

```bash
git clone https://github.com/ammarsarhan/hagz.git
cd hagz
```

### Backend Setup

```bash
cd api
npm install
```

Create `api/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/hagz"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
PORT=3001
NODE_ENV="development"
```

### Frontend Setup

```bash
cd ui
npm install
```

Create `ui/.env`:
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Database Migration

```bash
cd api
npx prisma generate
npx prisma migrate dev
npx prisma db seed  # Optional: seed with sample data
```

### Running the Application

Start Redis:
```bash
redis-server
```

Start Backend (Terminal 1):
```bash
cd api
npm run dev
```

Start Frontend (Terminal 2):
```bash
cd ui
npm run dev
```

Application available at `http://localhost:3000`

## Project Structure

```
hagz/
├── api/                        # Backend Express.js application
│   ├── src/
│   │   ├── controllers/       # Request handlers and business logic
│   │   ├── models/            # Prisma database models
│   │   ├── routes/            # API endpoint definitions
│   │   ├── services/          # Business logic layer
│   │   ├── middleware/        # Authentication, validation, error handling
│   │   ├── jobs/              # BullMQ job processors
│   │   ├── utils/             # Helper functions and utilities
│   │   └── config/            # Configuration files
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema definition
│   │   └── migrations/        # Version-controlled migrations
│   └── tests/                 # Unit and integration tests
│
├── ui/                         # Frontend Next.js application
│   ├── src/
│   │   ├── app/               # Next.js 13+ app directory
│   │   ├── components/        # Reusable React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # API clients and utilities
│   │   ├── types/             # TypeScript interfaces and types
│   │   └── contexts/          # React Context providers
│   └── tests/                 # Component and integration tests
│
└── .vscode/                   # Development environment configuration
```

## Development Practices Demonstrated

### Code Quality
- TypeScript strict mode enabled across all modules
- ESLint and Prettier for consistent code formatting
- Pre-commit hooks with Husky for automated quality checks
- Comprehensive error handling with custom error classes

### Database Management
- Schema versioning with Prisma migrations
- Query optimization with proper indexing
- Geospatial indexing for location-based queries
- Connection pooling for efficient resource usage

### API Development
- RESTful design principles
- Request validation middleware
- Rate limiting and throttling
- Comprehensive error responses
- API versioning strategy

## Available Scripts

### Backend
```bash
npm run dev          # Development server with hot reload
npm run build        # TypeScript compilation
npm start            # Production server
npm test             # Run test suite
npm run test:watch   # Test suite in watch mode
npm run migrate      # Run database migrations
npx prisma studio    # Database GUI
```

### Frontend
```bash
npm run dev          # Development server
npm run build        # Production build with optimization
npm start            # Production server
npm run lint         # ESLint code analysis
npm test             # Run test suite
```

## Core Features Implementation

### Authentication & Authorization
Implemented secure JWT-based authentication with refresh token rotation, password hashing using bcrypt, and role-based access control for multi-tenant access patterns.

### Booking Management
Built conflict-free booking system with pessimistic locking, preventing race conditions in concurrent reservation scenarios. Implemented booking expiration and automated cleanup jobs.

### Geospatial Search
Developed efficient radius-based search using PostGIS geography types, with distance calculations and sorting. Optimized with spatial indexes for sub-second query performance.

### Real-time Updates
Integrated WebSocket connections for live availability updates and booking notifications, providing instant feedback to users.

### Background Processing
Architected job queues for email notifications, booking confirmations, payment processing webhooks, and scheduled availability updates.

## Performance Optimizations

- Redis caching layer for frequently accessed data
- Database query optimization with explain analyze
- Lazy loading and code splitting in Next.js
- Image optimization with Next.js Image component
- API response compression with gzip
- Connection pooling for database efficiency

## Security Measures

- JWT token-based authentication with httpOnly cookies
- Input sanitization and validation using Zod schemas
- SQL injection prevention through Prisma parameterized queries
- XSS protection with Content Security Policy headers
- Rate limiting on authentication endpoints
- CORS configuration for cross-origin security

## Deployment Considerations

### Backend Deployment
- Containerization ready (Docker support)
- Environment variable management
- Database migration automation
- Health check endpoints
- Logging and monitoring integration points

### Frontend Deployment
- Static site generation where applicable
- Edge function support for dynamic routes
- CDN integration for static assets
- Environment-specific configuration

## Testing Strategy

- Unit tests for utility functions and business logic
- Integration tests for API endpoints
- Database transaction rollback in tests
- Mock external dependencies
- End-to-end testing with Cypress (planned)

## Professional Development Practices

This project demonstrates proficiency in:
- Full-stack TypeScript development
- Modern React patterns and hooks
- RESTful API design and implementation
- Relational database design and optimization
- Geospatial data handling
- Asynchronous programming and job queues
- Authentication and authorization systems
- Production-ready error handling
- Code organization and architecture patterns
- Version control with Git
- Documentation and code maintainability

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/feature-name`)
3. Write tests for new features
4. Ensure all tests pass (`npm test`)
5. Commit with conventional commit messages
6. Push to your fork and submit a pull request

## License

MIT License - See LICENSE file for details.

## Author

**Ammar Sarhan**
- GitHub: [@ammarsarhan](https://github.com/ammarsarhan)

## Technical Contact

For technical discussions or questions about implementation details, please open an issue in the repository.

---

This project serves as a portfolio piece demonstrating production-ready full-stack development skills with modern technologies and best practices.
