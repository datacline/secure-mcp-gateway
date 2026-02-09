package users

import (
	"net/http"

	"github.com/datacline/policy-engine/internal/models"
	"github.com/datacline/policy-engine/internal/storage"
	"github.com/gin-gonic/gin"
)

// Handler handles users API requests
type Handler struct {
	storage *storage.UsersStorage
}

// NewHandler creates a new users handler
func NewHandler(storage *storage.UsersStorage) *Handler {
	return &Handler{storage: storage}
}

// RegisterRoutes registers the users API routes
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Get all principals (users, groups, roles) - useful for dropdowns
	r.GET("/principals", h.GetAllPrincipals)

	// Users endpoints
	r.GET("/users", h.ListUsers)
	r.GET("/users/:id", h.GetUser)
	r.GET("/users/search", h.SearchUsers)

	// Groups endpoints
	r.GET("/groups", h.ListGroups)
	r.GET("/groups/:id", h.GetGroup)
	r.GET("/groups/:id/members", h.GetGroupMembers)
	r.GET("/groups/search", h.SearchGroups)

	// Roles endpoints
	r.GET("/roles", h.ListRoles)
	r.GET("/roles/:id", h.GetRole)
	r.GET("/roles/:id/users", h.GetRoleUsers)
	r.GET("/roles/search", h.SearchRoles)

	// Reload data
	r.POST("/principals/reload", h.Reload)
}

// GetAllPrincipals returns all users, groups, and roles
func (h *Handler) GetAllPrincipals(c *gin.Context) {
	data := h.storage.GetAllData()
	c.JSON(http.StatusOK, models.AllPrincipalsResponse{
		Users:  data.Users,
		Groups: data.Groups,
		Roles:  data.Roles,
	})
}

// ListUsers returns all users
func (h *Handler) ListUsers(c *gin.Context) {
	// Check for filters
	role := c.Query("role")
	group := c.Query("group")
	status := c.Query("status")

	var users []models.User

	if role != "" {
		users = h.storage.GetUsersByRole(role)
	} else if group != "" {
		users = h.storage.GetUsersByGroup(group)
	} else if status == "active" {
		users = h.storage.GetActiveUsers()
	} else {
		users = h.storage.GetAllUsers()
	}

	c.JSON(http.StatusOK, models.UsersResponse{
		Users: users,
		Count: len(users),
	})
}

// GetUser returns a user by ID
func (h *Handler) GetUser(c *gin.Context) {
	id := c.Param("id")

	user := h.storage.GetUserByID(id)
	if user == nil {
		// Try by email
		user = h.storage.GetUserByEmail(id)
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "User not found",
			"user_id": id,
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// SearchUsers searches users by query
func (h *Handler) SearchUsers(c *gin.Context) {
	query := c.Query("q")
	users := h.storage.SearchUsers(query)

	c.JSON(http.StatusOK, models.UsersResponse{
		Users: users,
		Count: len(users),
	})
}

// ListGroups returns all groups
func (h *Handler) ListGroups(c *gin.Context) {
	groups := h.storage.GetAllGroups()

	c.JSON(http.StatusOK, models.GroupsResponse{
		Groups: groups,
		Count:  len(groups),
	})
}

// GetGroup returns a group by ID
func (h *Handler) GetGroup(c *gin.Context) {
	id := c.Param("id")

	group := h.storage.GetGroupByID(id)
	if group == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":    "Group not found",
			"group_id": id,
		})
		return
	}

	c.JSON(http.StatusOK, group)
}

// GetGroupMembers returns users in a group
func (h *Handler) GetGroupMembers(c *gin.Context) {
	id := c.Param("id")

	// Verify group exists
	group := h.storage.GetGroupByID(id)
	if group == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":    "Group not found",
			"group_id": id,
		})
		return
	}

	users := h.storage.GetUsersByGroup(id)

	c.JSON(http.StatusOK, gin.H{
		"group":   group,
		"members": users,
		"count":   len(users),
	})
}

// SearchGroups searches groups by query
func (h *Handler) SearchGroups(c *gin.Context) {
	query := c.Query("q")
	groups := h.storage.SearchGroups(query)

	c.JSON(http.StatusOK, models.GroupsResponse{
		Groups: groups,
		Count:  len(groups),
	})
}

// ListRoles returns all roles
func (h *Handler) ListRoles(c *gin.Context) {
	roles := h.storage.GetAllRoles()

	c.JSON(http.StatusOK, models.RolesResponse{
		Roles: roles,
		Count: len(roles),
	})
}

// GetRole returns a role by ID
func (h *Handler) GetRole(c *gin.Context) {
	id := c.Param("id")

	role := h.storage.GetRoleByID(id)
	if role == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Role not found",
			"role_id": id,
		})
		return
	}

	c.JSON(http.StatusOK, role)
}

// GetRoleUsers returns users with a specific role
func (h *Handler) GetRoleUsers(c *gin.Context) {
	id := c.Param("id")

	// Verify role exists
	role := h.storage.GetRoleByID(id)
	if role == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Role not found",
			"role_id": id,
		})
		return
	}

	users := h.storage.GetUsersByRole(id)

	c.JSON(http.StatusOK, gin.H{
		"role":  role,
		"users": users,
		"count": len(users),
	})
}

// SearchRoles searches roles by query
func (h *Handler) SearchRoles(c *gin.Context) {
	query := c.Query("q")
	roles := h.storage.SearchRoles(query)

	c.JSON(http.StatusOK, models.RolesResponse{
		Roles: roles,
		Count: len(roles),
	})
}

// Reload reloads the users data from disk
func (h *Handler) Reload(c *gin.Context) {
	if err := h.storage.LoadAll(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to reload users data",
			"message": err.Error(),
		})
		return
	}

	data := h.storage.GetAllData()
	c.JSON(http.StatusOK, gin.H{
		"message": "Users data reloaded successfully",
		"users":   len(data.Users),
		"groups":  len(data.Groups),
		"roles":   len(data.Roles),
	})
}
