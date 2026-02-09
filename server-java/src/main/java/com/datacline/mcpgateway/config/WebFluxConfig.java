package com.datacline.mcpgateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.config.CorsRegistry;
import org.springframework.web.reactive.config.EnableWebFlux;
import org.springframework.web.reactive.config.WebFluxConfigurer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * WebFlux configuration for CORS and global settings.
 */
@Configuration
@EnableWebFlux
public class WebFluxConfig implements WebFluxConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(
                    "http://localhost:*",
                    "http://127.0.0.1:*",
                    "http://[::1]:*"
                )
                .allowedMethods(
                    "GET", 
                    "POST", 
                    "PUT", 
                    "DELETE", 
                    "OPTIONS", 
                    "HEAD", 
                    "PATCH"
                )
                .allowedHeaders(
                    "Origin",
                    "Content-Type",
                    "Accept",
                    "Authorization",
                    "X-Requested-With",
                    "Access-Control-Request-Method",
                    "Access-Control-Request-Headers"
                )
                .exposedHeaders(
                    "Content-Length",
                    "Content-Type",
                    "X-Content-Type-Options"
                )
                .allowCredentials(true)
                .maxAge(7200); // 2 hours
    }

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "http://[::1]:*"
        ));
        config.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "OPTIONS",
                "HEAD",
                "PATCH"
        ));
        config.setAllowedHeaders(List.of(
                "Origin",
                "Content-Type",
                "Accept",
                "Authorization",
                "X-Requested-With",
                "Access-Control-Request-Method",
                "Access-Control-Request-Headers"
        ));
        config.setExposedHeaders(List.of(
                "Content-Length",
                "Content-Type",
                "X-Content-Type-Options"
        ));
        config.setAllowCredentials(true);
        config.setMaxAge(7200L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}
