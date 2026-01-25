package com.datacline.mcpgateway.config;

import com.datacline.mcpgateway.config.GatewayConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * Security configuration for the MCP Gateway.
 * 
 * When auth is disabled (default for dev), all endpoints are permitted.
 * When auth is enabled (docker/prod), OAuth2 JWT authentication is required.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Autowired
    private GatewayConfig gatewayConfig;

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        if (!gatewayConfig.isAuthEnabled()) {
            // Disable security for development/testing
            return http
                    .csrf(ServerHttpSecurity.CsrfSpec::disable)
                    .authorizeExchange(exchanges -> exchanges
                            .anyExchange().permitAll()
                    )
                    .build();
        }

        // Enable OAuth2 JWT authentication for production
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers("/actuator/**").permitAll()
                        .pathMatchers("/h2-console/**").permitAll()
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> {})
                )
                .build();
    }
}
