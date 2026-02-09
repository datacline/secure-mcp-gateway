package evaluation

import (
	"github.com/datacline/policy-engine/internal/engine"
	"github.com/datacline/policy-engine/internal/models"
	log "github.com/sirupsen/logrus"
)

// Service handles policy evaluation operations
type Service struct {
	engine *engine.Engine
}

// NewService creates a new evaluation service
func NewService(policies []*models.Policy) *Service {
	return &Service{
		engine: engine.NewEngine(policies),
	}
}

// Evaluate evaluates a single policy request
func (s *Service) Evaluate(req *models.PolicyEvaluationRequest) (*models.PolicyEvaluationResult, error) {
	result := s.engine.Evaluate(req)
	
	log.WithFields(log.Fields{
		"user":         req.User,
		"tool":         req.Tool,
		"action":       result.Action,
		"should_block": result.ShouldBlock,
		"matched":      result.Matched,
	}).Debug("Policy evaluated")
	
	return result, nil
}

// BatchEvaluate evaluates multiple policy requests
func (s *Service) BatchEvaluate(req *models.BatchEvaluationRequest) (*models.BatchEvaluationResponse, error) {
	results := make([]models.PolicyEvaluationResult, len(req.Requests))
	
	for i, evalReq := range req.Requests {
		// Pass pointer to evalReq and dereference the result
		result := s.engine.Evaluate(&evalReq)
		results[i] = *result
	}
	
	log.WithField("count", len(results)).Debug("Batch evaluation completed")
	
	return &models.BatchEvaluationResponse{
		Results: results,
	}, nil
}

// Reload reloads the evaluation engine with new policies
func (s *Service) Reload(policies []*models.Policy) {
	s.engine = engine.NewEngine(policies)
	log.WithField("count", len(policies)).Info("Evaluation engine reloaded")
}

// GetPolicyCount returns the number of policies loaded
func (s *Service) GetPolicyCount() int {
	// This would need to be exposed from the engine
	// For now, return a placeholder
	return 0
}
