package com.datacline.mcpgateway.service.auth;

import com.datacline.mcpgateway.config.GatewayConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Authentication service - stub version for anonymous access.
 * TODO: Implement full Spring Security integration with JWT later.
 */
@Service
public class AuthService {

    @Autowired
    GatewayConfig gatewayConfig;

    /**
     * Get current user - returns anonymous user since auth is disabled.
     */
    public Map<String, Object> getCurrentUser() {
        Map<String, Object> user = new HashMap<>();
        user.put("sub", "anonymous");
        user.put("preferred_username", "anonymous");
        user.put("email", "anonymous@localhost");
        user.put("roles", List.of("admin"));
        user.put("groups", List.of());
        user.put("authenticated", false);
        return user;
    }

    /**
     * Get optional user (returns anonymous for now).
     */
    public Map<String, Object> getOptionalUser() {
        return getCurrentUser();
    }
}
