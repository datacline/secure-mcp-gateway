package config

import (
	"os"
	"strconv"
)

// Config holds application configuration
type Config struct {
	// Server configuration
	Port        string
	Environment string
	
	// Service enablement
	EnableEvaluation bool
	EnableManagement bool
	
	// Policy configuration
	PolicyDir string
	
	// Logging
	LogLevel string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Port:             getEnv("PORT", "9000"),
		Environment:      getEnv("ENVIRONMENT", "production"),
		EnableEvaluation: getBoolEnv("ENABLE_EVALUATION", true),
		EnableManagement: getBoolEnv("ENABLE_MANAGEMENT", true),
		PolicyDir:        getEnv("POLICY_DIR", "./policies"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
	}
}

// IsEvaluationOnly returns true if only evaluation service is enabled
func (c *Config) IsEvaluationOnly() bool {
	return c.EnableEvaluation && !c.EnableManagement
}

// IsManagementOnly returns true if only management service is enabled
func (c *Config) IsManagementOnly() bool {
	return !c.EnableEvaluation && c.EnableManagement
}

// IsCombined returns true if both services are enabled
func (c *Config) IsCombined() bool {
	return c.EnableEvaluation && c.EnableManagement
}

// GetServiceName returns a descriptive service name
func (c *Config) GetServiceName() string {
	if c.IsEvaluationOnly() {
		return "policy-evaluation"
	}
	if c.IsManagementOnly() {
		return "policy-management"
	}
	return "policy-engine"
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
