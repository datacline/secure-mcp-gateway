package main

import (
	"os"
	"time"

	gatewayProxy "github.com/datacline/policy-engine/internal/api/gateway_proxy"
	"github.com/datacline/policy-engine/internal/api/health"
	"github.com/datacline/policy-engine/internal/api/management"
	"github.com/datacline/policy-engine/internal/clients/java_gateway"
	"github.com/datacline/policy-engine/internal/config"
	mgmtService "github.com/datacline/policy-engine/internal/services/management"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Management-only service entry point
// This binary only handles policy CRUD operations, not evaluation
// Suitable for administrative/control plane deployments
func main() {
	// Force management-only mode
	os.Setenv("ENABLE_EVALUATION", "false")
	os.Setenv("ENABLE_MANAGEMENT", "true")

	cfg := config.LoadConfig()
	setupLogging(cfg.LogLevel)

	log.WithFields(log.Fields{
		"service":    "policy-management-only",
		"port":       cfg.Port,
		"policy_dir": cfg.PolicyDir,
	}).Info("Starting Policy Management Service (CRUD only)")

	// Initialize Java gateway client
	javaGatewayURL := os.Getenv("JAVA_GATEWAY_URL")
	if javaGatewayURL == "" {
		javaGatewayURL = "http://localhost:8000"
	}
	gatewayClient := java_gateway.NewClient(javaGatewayURL)

	// Health check
	if err := gatewayClient.HealthCheck(); err != nil {
		log.WithError(err).Warn("Java gateway not available")
	} else {
		log.WithField("url", javaGatewayURL).Info("Java gateway connected")
	}

	// Initialize management service
	mgmtSvc, err := mgmtService.NewService(cfg.PolicyDir)
	if err != nil {
		log.WithError(err).Fatal("Failed to initialize management service")
	}
	log.Info("Management service initialized")

	// Setup router
	router := gin.Default()

	// Setup CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health checks
	healthHandler := health.NewHandler("policy-management")
	healthHandler.RegisterRoutes(router)

	// API routes
	api := router.Group("/api/v1")
	
	// Register gateway proxy endpoints
	gatewayProxyHandler := gatewayProxy.NewHandler(gatewayClient)
	gatewayProxyHandler.RegisterRoutes(api)
	log.Info("Gateway proxy endpoints registered")
	
	// Register management endpoints
	mgmtHandler := management.NewHandler(mgmtSvc, nil) // No evaluation service in this mode
	mgmtHandler.RegisterRoutes(api)

	log.WithField("port", cfg.Port).Info("Policy Management Service ready (CRUD only)")
	log.Warn("Evaluation endpoints are NOT available in this deployment")
	log.Info("Policy changes are persisted but not evaluated by this service")

	if err := router.Run(":" + cfg.Port); err != nil {
		log.WithError(err).Fatal("Failed to start server")
	}
}

func setupLogging(level string) {
	log.SetFormatter(&log.JSONFormatter{})
	log.SetOutput(os.Stdout)

	switch level {
	case "debug":
		log.SetLevel(log.DebugLevel)
	case "info":
		log.SetLevel(log.InfoLevel)
	case "warn":
		log.SetLevel(log.WarnLevel)
	case "error":
		log.SetLevel(log.ErrorLevel)
	default:
		log.SetLevel(log.InfoLevel)
	}
}
