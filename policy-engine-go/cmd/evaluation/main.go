package main

import (
	"os"
	"time"

	"github.com/datacline/policy-engine/internal/api/evaluation"
	gatewayProxy "github.com/datacline/policy-engine/internal/api/gateway_proxy"
	"github.com/datacline/policy-engine/internal/api/health"
	"github.com/datacline/policy-engine/internal/clients/java_gateway"
	"github.com/datacline/policy-engine/internal/config"
	evalService "github.com/datacline/policy-engine/internal/services/evaluation"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// Evaluation-only service entry point
// This binary only handles policy evaluation, not management
// Suitable for high-throughput, read-only deployments
func main() {
	// Force evaluation-only mode
	os.Setenv("ENABLE_EVALUATION", "true")
	os.Setenv("ENABLE_MANAGEMENT", "false")

	cfg := config.LoadConfig()
	setupLogging(cfg.LogLevel)

	log.WithFields(log.Fields{
		"service":    "policy-evaluation-only",
		"port":       cfg.Port,
		"policy_dir": cfg.PolicyDir,
	}).Info("Starting Policy Evaluation Service (read-only)")

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

	// Load policies from disk
	policies, err := config.LoadPolicies(cfg.PolicyDir)
	if err != nil {
		log.WithError(err).Fatal("Failed to load policies")
	}

	// Initialize evaluation service
	evalSvc := evalService.NewService(policies)
	log.WithField("policy_count", len(policies)).Info("Evaluation service initialized")

	// Setup router
	router := gin.Default()

	// Setup CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health checks
	healthHandler := health.NewHandler("policy-evaluation")
	healthHandler.RegisterRoutes(router)

	// API routes
	api := router.Group("/api/v1")
	
	// Register gateway proxy endpoints
	gatewayProxyHandler := gatewayProxy.NewHandler(gatewayClient)
	gatewayProxyHandler.RegisterRoutes(api)
	log.Info("Gateway proxy endpoints registered")
	
	// Register evaluation endpoints
	evalHandler := evaluation.NewHandler(evalSvc)
	evalHandler.RegisterRoutes(api)

	log.WithField("port", cfg.Port).Info("Policy Evaluation Service ready (read-only)")
	log.Warn("Management endpoints are NOT available in this deployment")

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
