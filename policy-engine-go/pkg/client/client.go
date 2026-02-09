package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/datacline/policy-engine/internal/models"
)

// Client is a policy engine HTTP client
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new policy engine client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Evaluate sends a policy evaluation request
func (c *Client) Evaluate(req *models.PolicyEvaluationRequest) (*models.PolicyEvaluationResult, error) {
	url := fmt.Sprintf("%s/api/v1/evaluate", c.baseURL)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	var result models.PolicyEvaluationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// BatchEvaluate sends a batch policy evaluation request
func (c *Client) BatchEvaluate(requests []models.PolicyEvaluationRequest) ([]models.PolicyEvaluationResult, error) {
	url := fmt.Sprintf("%s/api/v1/evaluate/batch", c.baseURL)
	
	batchReq := models.BatchEvaluationRequest{Requests: requests}
	jsonData, err := json.Marshal(batchReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	var batchResp models.BatchEvaluationResponse
	if err := json.NewDecoder(resp.Body).Decode(&batchResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return batchResp.Results, nil
}

// Reload triggers a policy reload
func (c *Client) Reload() error {
	url := fmt.Sprintf("%s/api/v1/reload", c.baseURL)
	
	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("failed to send reload request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// HealthCheck checks if the service is healthy
func (c *Client) HealthCheck() error {
	url := fmt.Sprintf("%s/health", c.baseURL)
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return fmt.Errorf("failed to send health check: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed with status %d", resp.StatusCode)
	}

	return nil
}

// ============================================================================
// Policy CRUD Operations
// ============================================================================

// ListPolicies retrieves all policies
func (c *Client) ListPolicies() ([]*models.Policy, error) {
	url := fmt.Sprintf("%s/api/v1/policies", c.baseURL)
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Policies []*models.Policy `json:"policies"`
		Count    int              `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Policies, nil
}

// GetPolicy retrieves a specific policy by ID
func (c *Client) GetPolicy(id string) (*models.Policy, error) {
	url := fmt.Sprintf("%s/api/v1/policies/%s", c.baseURL, id)
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("policy not found: %s", id)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var policy models.Policy
	if err := json.NewDecoder(resp.Body).Decode(&policy); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &policy, nil
}

// CreatePolicy creates a new policy
func (c *Client) CreatePolicy(policy *models.Policy) (*models.Policy, error) {
	url := fmt.Sprintf("%s/api/v1/policies", c.baseURL)
	
	jsonData, err := json.Marshal(policy)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal policy: %w", err)
	}

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var created models.Policy
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &created, nil
}

// UpdatePolicy updates an existing policy
func (c *Client) UpdatePolicy(id string, policy *models.Policy) (*models.Policy, error) {
	url := fmt.Sprintf("%s/api/v1/policies/%s", c.baseURL, id)
	
	jsonData, err := json.Marshal(policy)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal policy: %w", err)
	}

	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to update policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var updated models.Policy
	if err := json.NewDecoder(resp.Body).Decode(&updated); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &updated, nil
}

// DeletePolicy deletes a policy
func (c *Client) DeletePolicy(id string) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s", c.baseURL, id)
	
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// EnablePolicy enables a policy
func (c *Client) EnablePolicy(id string) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s/enable", c.baseURL, id)
	
	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("failed to enable policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// DisablePolicy disables a policy
func (c *Client) DisablePolicy(id string) error {
	url := fmt.Sprintf("%s/api/v1/policies/%s/disable", c.baseURL, id)
	
	resp, err := c.httpClient.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("failed to disable policy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ValidatePolicy validates a policy without creating it
func (c *Client) ValidatePolicy(policy *models.Policy) (bool, error) {
	url := fmt.Sprintf("%s/api/v1/policies/validate", c.baseURL)
	
	jsonData, err := json.Marshal(policy)
	if err != nil {
		return false, fmt.Errorf("failed to marshal policy: %w", err)
	}

	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("failed to validate policy: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Valid   bool   `json:"valid"`
		Message string `json:"message"`
		Error   string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode response: %w", err)
	}

	if !result.Valid {
		return false, fmt.Errorf("validation failed: %s", result.Error)
	}

	return true, nil
}
