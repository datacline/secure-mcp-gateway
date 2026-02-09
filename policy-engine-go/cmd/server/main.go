package main

import (
	"os"
	"time"

	"github.com/datacline/policy-engine/internal/api/catalog"
	"github.com/datacline/policy-engine/internal/api/evaluation"
	"github.com/datacline/policy-engine/internal/api/health"
	"github.com/datacline/policy-engine/internal/api/management"
	"github.com/datacline/policy-engine/internal/api/unified"
	"github.com/datacline/policy-engine/internal/api/users"
	"github.com/datacline/policy-engine/internal/config"
	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/storage"
	evalService "github.com/datacline/policy-engine/internal/services/evaluation"
	mgmtService "github.com/datacline/policy-engine/internal/services/management"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	gatewayProxy "github.com/datacline/policy-engine/internal/api/gateway_proxy"
	"github.com/datacline/policy-engine/internal/clients/java_gateway"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Setup logging
	setupLogging(cfg.LogLevel)

	log.WithFields(log.Fields{
		"service":     cfg.GetServiceName(),
		"port":        cfg.Port,
		"policy_dir":  cfg.PolicyDir,
		"environment": cfg.Environment,
		"evaluation":  cfg.EnableEvaluation,
		"management":  cfg.EnableManagement,
	}).Info("Starting Policy Engine")

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

	// Health checks (always available)
	healthHandler := health.NewHandler(cfg.GetServiceName())
	healthHandler.RegisterRoutes(router)

	// Initialize services based on configuration
	var evalSvc *evalService.Service
	var mgmtSvc *mgmtService.Service

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

	// Initialize management service if enabled
	if cfg.EnableManagement {
		var err error
		mgmtSvc, err = mgmtService.NewService(cfg.PolicyDir)
		if err != nil {
			log.WithError(err).Fatal("Failed to initialize management service")
		}
		log.Info("Management service initialized")
	}

	// Initialize evaluation service if enabled
	if cfg.EnableEvaluation {
		var policies []*models.Policy
		
		if mgmtSvc != nil {
			// Get policies from management service
			policies = mgmtSvc.ListPolicies()
		} else {
			// Load policies directly from disk (evaluation-only mode)
			var err error
			policies, err = config.LoadPolicies(cfg.PolicyDir)
			if err != nil {
				log.WithError(err).Fatal("Failed to load policies")
			}
		}
		
		evalSvc = evalService.NewService(policies)
		log.WithField("policy_count", len(policies)).Info("Evaluation service initialized")
	}

	// Setup API routes
	api := router.Group("/api/v1")

	// Register gateway proxy endpoints (MCP server discovery)
	gatewayProxyHandler := gatewayProxy.NewHandler(gatewayClient)
	gatewayProxyHandler.RegisterRoutes(api)
	log.Info("Gateway proxy endpoints registered")

	// Register evaluation endpoints
	if cfg.EnableEvaluation && evalSvc != nil {
		evalHandler := evaluation.NewHandler(evalSvc)
		evalHandler.RegisterRoutes(api)
		log.Info("Evaluation endpoints registered")
	}

	// Register management endpoints
	if cfg.EnableManagement && mgmtSvc != nil {
		if !cfg.EnableEvaluation {
			// Management-only mode: no evaluation service to sync with
			log.Warn("Running in management-only mode: policy changes will not be evaluated")
		}
		
		mgmtHandler := management.NewHandler(mgmtSvc, evalSvc)
		mgmtHandler.RegisterRoutes(api)
		log.Info("Management endpoints registered")
	}

	// Initialize unified policy storage and handlers
	unifiedStorage, err := storage.NewUnifiedStorage(cfg.PolicyDir)
	if err != nil {
		log.WithError(err).Fatal("Failed to initialize unified policy storage")
	}
	unifiedHandler := unified.NewHandler(unifiedStorage)
	unifiedHandler.RegisterRoutes(api)
	log.WithField("policy_count", len(unifiedStorage.GetAll())).Info("Unified policy endpoints registered")

	// Initialize users storage and handlers
	// Users data is stored in the data/ directory relative to the policy dir's parent
	dataDir := cfg.PolicyDir + "/../data"
	usersStorage, err := storage.NewUsersStorage(dataDir)
	if err != nil {
		log.WithError(err).Warn("Failed to initialize users storage, using empty data")
	} else {
		usersHandler := users.NewHandler(usersStorage)
		usersHandler.RegisterRoutes(api)
		log.Info("Users/principals endpoints registered")
	}

	// Initialize MCP catalog handler (proxies Postman MCP Catalog API)
	catalogHandler := catalog.NewHandler()
	catalogHandler.RegisterRoutes(api)
	log.Info("MCP Catalog endpoints registered")

	// Start server
	log.WithFields(log.Fields{
		"port":    cfg.Port,
		"service": cfg.GetServiceName(),
	}).Info("Policy Engine ready")

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
