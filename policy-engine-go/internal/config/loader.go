package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// LoadPolicies loads all policies from the specified directory
func LoadPolicies(policyDir string) ([]*models.Policy, error) {
	log.WithField("dir", policyDir).Info("Loading policies")

	var policies []*models.Policy

	// Read all .yaml/.yml files from policy directory
	files, err := os.ReadDir(policyDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy directory: %w", err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		name := file.Name()
		if !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
			continue
		}

		policyPath := filepath.Join(policyDir, name)
		policy, err := LoadPolicy(policyPath)
		if err != nil {
			log.WithError(err).WithField("file", name).Warn("Failed to load policy")
			continue
		}

		policies = append(policies, policy)
		log.WithFields(log.Fields{
			"file":   name,
			"policy": policy.Name,
			"rules":  len(policy.Rules),
		}).Info("Loaded policy")
	}

	return policies, nil
}

// LoadPolicy loads a single policy from a YAML file
func LoadPolicy(path string) (*models.Policy, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy file: %w", err)
	}

	var policy models.Policy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("failed to parse policy YAML: %w", err)
	}

	// Set defaults
	if policy.Version == 0 {
		policy.Version = 1
	}
	if policy.Enforcement == "" {
		policy.Enforcement = "blocking"
	}
	for i := range policy.Rules {
		if policy.Rules[i].Priority == 0 {
			policy.Rules[i].Priority = 100
		}
	}

	return &policy, nil
}

// ReloadPolicies reloads policies from directory
func ReloadPolicies(policyDir string) ([]*models.Policy, error) {
	log.Info("Reloading policies")
	return LoadPolicies(policyDir)
}
