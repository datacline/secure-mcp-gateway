####
# This Dockerfile is used to build a container image for the MCP Gateway Java application
# It uses a multi-stage build to minimize the final image size
####

# Build stage
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Copy Maven files for dependency caching
COPY pom.xml .

# Download dependencies (cached layer)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Copy configuration files
COPY mcp_servers.yaml .

# Build the application
RUN mvn clean package -DskipTests -B

####
# Runtime stage
####
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy the built Spring Boot jar
COPY --from=builder /build/target/*.jar /app/application.jar

# Copy default MCP server configuration
COPY --from=builder /build/mcp_servers.yaml /app/mcp_servers.yaml

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chmod 777 /app/logs /app/data

# Set environment variables
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENV SPRING_PROFILES_ACTIVE=docker

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/actuator/health || exit 1

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/application.jar"]
